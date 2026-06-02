import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import JSZip from "jszip";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Setup multer in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Initialize Gemini Client Lazily to prevent crash on module load when API key is missing
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    aiInstance = new GoogleGenAI({
      apiKey: key || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

app.use(express.json());

// Helper: Securely check if Gemini is configured/available
function checkApiKey() {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
    console.warn("WARNING: GEMINI_API_KEY is not set or using the template default. Gemini API calls will fail.");
    return false;
  }
  return true;
}

// 1. PPTX Parsing Endpoint
app.post("/api/upload-pptx", upload.single("file"), async (req, res): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "未检测到上传的文件。" });
    }

    const buffer = req.file.buffer;
    const zip = await JSZip.loadAsync(buffer);
    
    // Find slide files in presentation (e.g. ppt/slides/slide1.xml)
    const slideFiles: { name: string; file: JSZip.JSZipObject }[] = [];
    zip.forEach((relativePath, file) => {
      if (/^ppt\/slides\/slide\d+\.xml$/.test(relativePath)) {
        slideFiles.push({ name: relativePath, file });
      }
    });

    if (slideFiles.length === 0) {
      return res.status(400).json({ 
        error: "此文件可能不是标准的 PPTX 演示文档，或者不包含任何幻灯片页面。请确认后重新上传。" 
      });
    }

    // Sort slides numerically so slide2.xml is before slide10.xml
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)![0], 10);
      const numB = parseInt(b.name.match(/\d+/)![0], 10);
      return numA - numB;
    });

    const parsedSlidesTexts: { slideNum: number; rawText: string }[] = [];

    // Extract text strings from each slide
    for (let i = 0; i < slideFiles.length; i++) {
      const slide = slideFiles[i];
      const content = await slide.file.async("string");
      
      // XML texts are inside `<a:t>...</a:t>` tags in pptx
      const textMatches: string[] = [];
      const regex = /<a:t[^>]*>(.*?)<\/a:t>/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        // Decode simple XML entities
        let text = match[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim();
        if (text) textMatches.push(text);
      }

      parsedSlidesTexts.push({
        slideNum: i + 1,
        rawText: textMatches.join(" \n "),
      });
    }

    // Now, send the extracted text to Gemini to structure it into slides and generate educational narrator scripts.
    if (!checkApiKey()) {
      // Return beautiful structured mock data if API key is not configured, to let the user try it out!
      return res.json({
        slides: parsedSlidesTexts.map((item, idx) => ({
          title: `幻灯片 ${item.slideNum}:提取文本`,
          content: [
            item.rawText.substring(0, 40) || "本页无文本内容",
            "建议在 [AI妙笔] 中一键生成完整的微课脚本"
          ],
          script: `大家好，现在我们看到的是第 ${item.slideNum} 页幻灯片。这里的核心内容包括：${item.rawText.substring(0, 80) || "本页主要展示相关图表与核心主题。"}。接下来我们深入讲解。`
        }))
      });
    }

    const promptText = `
      你是一个专业的教育微课课件整理助教。我从一个教师上传的 PPTX 演示文档中提取了 ${parsedSlidesTexts.length} 页幻灯片的原始文本。
      请将这些原始文本进行结构化重构，为每一页提取或生成一个清晰精炼的[主题标题](最多15个字)和[页面核心纲要点](2-4个，每个15-30个字)，并以此课件内容为基础，撰写生动有吸引力的[微课授课讲稿、旁白 script](大约80-150个字)，声音以口语化的教师授课语气展开。
      
      PPT 原始提取文本数据如下：
      ${JSON.stringify(parsedSlidesTexts)}
    `;

    const response = await getGeminiClient().models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: "你是一个资深的特级名师及多媒体教学微课专家。将散乱的PPT提取文本结构化整合为精妙的教学幻灯片核心要点，并为每一页幻灯片编写富有亲和力、条理清晰、契合该页教具内容的教师讲课口述讲稿。请输出符合指定结构的 JSON 数据。",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slides: {
              type: Type.ARRAY,
              description: "幻灯片数组",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "页面的精炼标题" },
                  content: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "页面上展示的 2-4 条核心知识纲要点"
                  },
                  script: { type: Type.STRING, description: "配套本页课件的高质量口述讲课台词 script" }
                },
                required: ["title", "content", "script"]
              }
            }
          },
          required: ["slides"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return res.json(result);

  } catch (err: any) {
    console.error("Error processing PPTX:", err);
    return res.status(500).json({ error: `PPTX 解析生成失败: ${err.message || err}` });
  }
});

// 2. Prompt-based Presentation Generator Endpoint
app.post("/api/generate-from-prompt", async (req, res): Promise<any> => {
  try {
    const { prompt, slideCount = 5, tone = "professional" } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "请输入生成主题。" });
    }

    if (!checkApiKey()) {
      // Mock generated response if API Key is not set yet
      const mockResult = {
        slides: Array.from({ length: slideCount }).map((_, i) => ({
          title: `第 ${i + 1} 课: ${prompt} 概述`,
          content: [
            `这是关于 [${prompt}] 的核心要点一`,
            "运用多媒体交互模块展示关键概念",
            "通过AI配音与视频流结合进行知识传递"
          ],
          script: `同学们好！今天我们来学习有关【${prompt}】的第 ${i + 1} 个知识点。大家请看屏幕，核心的概念和公式都已经帮大家梳理好了。接下来我会详细为大家拆解这一部分的重难点，请大家做好笔记。`
        }))
      };
      return res.json(mockResult);
    }

    const systemInstruction = `
      你是一个顶尖的课程设计师和多媒体脚本规划师。
      根据用户输入的微课主题，一键产出一份高水平的微课微课程大纲设计（包含 ${slideCount} 页）。
      每一页设计需要有一个精致的主题标题(title，不超过15个字)、展示在课件页面上的知识梳理要点(content，包括 2-4 条，每条15-35个字)，
      以及和该页教学内容严格吻合、讲授生动有趣的口语化录课旁白配音脚本(script，大约100-150个字)。
      
      教学风格/语气要求：${
        tone === "humorous"
          ? "幽默风趣，喜欢讲段子和比喻，极具互动感"
          : tone === "kids"
          ? "充满童趣，温柔亲切，面向幼儿园或小学低年级，句式简单可爱"
          : tone === "story"
          ? "讲故事方式，娓娓道来，设置悬念，吸引人不断听下去"
          : tone === "academic"
          ? "逻辑严密，理性深刻，偏大学/高中学术探讨，概念严谨"
          : "标准特级教师风格，生动形象，重点清晰，亲切有魅力"
      }。
    `;

    const requestPrompt = `为以下主题智能规划制作一份 ${slideCount} 页的微课内容大纲及配音稿：\n主题："${prompt}"`;

    const response = await getGeminiClient().models.generateContent({
      model: "gemini-3.5-flash",
      contents: requestPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slides: {
              type: Type.ARRAY,
              description: "生成的微课页面列表",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "课件标题" },
                  content: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "课件主体梳理文字（核心纲要）"
                  },
                  script: { type: Type.STRING, description: "教师的口语化授课配音配音稿 script" }
                },
                required: ["title", "content", "script"]
              }
            }
          },
          required: ["slides"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return res.json(result);

  } catch (err: any) {
    console.error("Error generating from prompt:", err);
    return res.status(500).json({ error: `AI 智能建课失败: ${err.message || err}` });
  }
});

// 3. Single Slide Script Translation/Rewrite Endpoint
app.post("/api/rewrite-script", async (req, res): Promise<any> => {
  try {
    const { slideTitle, slideContent, originalScript, tone } = req.body;
    
    if (!slideTitle || !slideContent) {
      return res.status(400).json({ error: "幻灯片标题与内容为必填项。" });
    }

    if (!checkApiKey()) {
      return res.json({
        script: `[API未配置模版] 针对“${slideTitle}”，教师说道：很高兴和大家一起交流这一节的内容。我们在这页主要展示了：${slideContent.join("，")}。大家可以通过这一页的纲要清晰地掌握核心。`
      });
    }

    const response = await getGeminiClient().models.generateContent({
      model: "gemini-3.5-flash",
      contents: `
        请为以下幻灯片页面重新编写、润色或优化一段口述录课讲稿（微课旁白 script）。
        幻灯片标题: "${slideTitle}"
        幻灯片要点内容: ${JSON.stringify(slideContent)}
        当前配音稿 (可作参考): "${originalScript || ""}"
        
        语气/教学风格要求: ${
          tone === "humorous"
            ? "十分风趣幽默，爱打比方，充满互动"
            : tone === "kids"
            ? "温柔亲切、充满童真、适合小朋友听"
            : tone === "story"
            ? "讲故事风格、扣人心弦、极具带入感"
            : tone === "academic"
            ? "严谨，理性思考，逻辑严密 academic style"
            : "优秀的金牌教师教学腔调，通俗易懂，重点突出"
        }
        字数严格控制在 80 到 150 字之间。不要带有任何多余的格式，直接给出你要朗读的内容，适合合成录音。
      `,
      config: {
        systemInstruction: "你是一个专业的微课编导和朗美配音剧作师。直接输出重新优化后的中国标准普通话微课讲稿纯文本。千万不要带有诸如‘好的，这是为您重写的配音。’之类的废话前缀，也不要使用括号进行动作标注，所有的文字必须是可供合成朗诵的台词文本。"
      }
    });

    const resultScript = response.text?.trim() || "";
    return res.json({ script: resultScript });

  } catch (err: any) {
    console.error("Error rewriting script:", err);
    return res.status(500).json({ error: `讲稿智能优化失败: ${err.message || err}` });
  }
});

// Start integration with Vite in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Kejianbang AI App] Server running on http://localhost:${PORT}`);
  });
}

startServer();
