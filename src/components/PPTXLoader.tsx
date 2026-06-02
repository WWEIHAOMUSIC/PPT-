import React, { useState } from "react";
import { Upload, Sparkles, BookOpen, Clock, Bot, Cpu, FileText, ArrowRight, CheckCircle2 } from "lucide-react";

interface PPTXLoaderProps {
  onSlidesLoaded: (slides: any[], title: string, tone?: string) => void;
}

export default function PPTXLoader({ onSlidesLoaded }: PPTXLoaderProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "ai">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [topicPrompt, setTopicPrompt] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const [teachingTone, setTeachingTone] = useState("standard");

  // File drag & drop states
  const [isDragging, setIsDragging] = useState(false);

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle Drag Leave
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Process File upload to backend API
  const uploadFile = async (file: File) => {
    if (!file.name.endsWith(".pptx")) {
      setErrorMsg("目前仅支持加载标准格式的幻灯片演示文件 (.pptx)。");
      return;
    }

    setIsUploading(true);
    setErrorMsg("");
    setProgressMsg("正在传输并解析您的演示文档...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload-pptx", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = "解析PPT失败，请检查文件是否损坏";
        try {
          const text = await response.text();
          const parsed = JSON.parse(text);
          errorMsg = parsed.error || errorMsg;
        } catch {
          // Keep default if JSON parsing fails on HTML response
        }
        throw new Error(errorMsg);
      }

      setProgressMsg("生成智能配音脚本稿中...");
      const textResponse = await response.text();
      let data: any;
      try {
        data = JSON.parse(textResponse);
      } catch {
        throw new Error("服务器返回非法的JSON格式响应，生成失败。");
      }

      if (data.slides && data.slides.length > 0) {
        onSlidesLoaded(data.slides, file.name.replace(".pptx", ""), teachingTone);
      } else {
        throw new Error("未能成功从您的幻灯片中恢复内容。");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "上传解析出现未知错误，请重试。");
    } finally {
      setIsUploading(false);
      setProgressMsg("");
    }
  };

  // Handle Drop event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      uploadFile(file);
    }
  };

  // Handle manual file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      uploadFile(file);
    }
  };

  // Handle AI Content generation from Topic prompt
  const handleAIGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicPrompt.trim()) {
      setErrorMsg("请输入您想要设计的微课主题或教学大纲。");
      return;
    }

    setIsGenerating(true);
    setErrorMsg("");
    setProgressMsg("智能AI名师正在为您规划设计课程板块...");

    try {
      const response = await fetch("/api/generate-from-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: topicPrompt.trim(),
          slideCount,
          tone: teachingTone,
        }),
      });

      if (!response.ok) {
        let errorMsg = "AI智能生成排版失败，请稍后重试";
        try {
          const text = await response.text();
          const parsed = JSON.parse(text);
          errorMsg = parsed.error || errorMsg;
        } catch {
          // ignore parsing error on HTML
        }
        throw new Error(errorMsg);
      }

      setProgressMsg("正在针对知识大纲撰写精美授课配音稿...");
      const textResponse = await response.text();
      let data: any;
      try {
        data = JSON.parse(textResponse);
      } catch {
        throw new Error("服务器返回非法的JSON格式响应，生成失败。");
      }

      if (data.slides && data.slides.length > 0) {
        onSlidesLoaded(data.slides, `${topicPrompt.trim()} - AI微课制作`, teachingTone);
      } else {
        throw new Error("未能成功生成结构化幻灯片。");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "智能AI备课暂未成功，请稍后再试。");
    } finally {
      setIsGenerating(false);
      setProgressMsg("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xl overflow-hidden p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          制作您的专属 AI 授课微课视频
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-xl mx-auto leading-relaxed">
          仿照「课件帮」架构，只需拖拽上传您写好的幻灯片PPT，或输入您的授课教案大纲，AI
          将全自动梳理知识架构，为您编写口语化名师台词，合成配音并一键输出演示微视频！
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200/80 mb-8 p-1 bg-slate-50 rounded-xl max-w-md mx-auto">
        <button
          onClick={() => {
            setActiveTab("upload");
            setErrorMsg("");
          }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "upload"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Upload className="w-4 h-4" />
          上传 PPTX
        </button>
        <button
          onClick={() => {
            setActiveTab("ai");
            setErrorMsg("");
          }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === "ai"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI 一键创作
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
          <span className="font-bold text-rose-800 mt-px">提示：</span>
          <p className="leading-relaxed font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Upload PPT Layout */}
      {activeTab === "upload" && (
        <div>
          {isUploading ? (
            <div className="border-2 border-dashed border-emerald-300 rounded-2xl bg-emerald-50/20 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="relative mb-4">
                <Cpu className="w-12 h-12 text-emerald-600 animate-spin" />
                <Bot className="w-6 h-6 text-teal-500 absolute -bottom-1 -right-1" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">{progressMsg}</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                AI 正在提取您的幻灯片标题与内页纲要，并为您定制高水平口播讲师讲稿稿，请勿关闭本页...
              </p>
              {/* Progress Bar Animation */}
              <div className="w-64 bg-slate-200 h-1.5 rounded-full mt-5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full animate-[shimmer_1.5s_infinite] w-3/4"></div>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all min-h-[300px] flex flex-col items-center justify-center ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50/40"
                  : "border-slate-300/80 hover:border-emerald-400 hover:bg-slate-50/60"
              }`}
              onClick={() => document.getElementById("pptx-upload-input")?.click()}
            >
              <input
                id="pptx-upload-input"
                type="file"
                accept=".pptx"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-sm shadow-emerald-100">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">
                拖拽幻灯片文件到这里，或 <span className="text-emerald-600 underline">点击上传</span>
              </h3>
              <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                仅支持后缀为 <span className="font-bold text-slate-500">.pptx</span> 的原始文件项目
                文件体积 50MB 以内。AI将自动提取文字并匹配智能配音讲稿。
              </p>
              <div className="flex items-center gap-4 mt-6 text-slate-400 text-xs">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 文字自动提取
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 配音稿自动填充
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Topic Prompt generator Layout */}
      {activeTab === "ai" && (
        <form onSubmit={handleAIGenerate} className="space-y-6">
          {isGenerating ? (
            <div className="border-2 border-dashed border-emerald-300 rounded-2xl bg-emerald-50/20 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="relative mb-4">
                <Bot className="w-12 h-12 text-emerald-600 animate-bounce" />
                <Sparkles className="w-6 h-6 text-teal-400 absolute -top-1 -right-1" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">{progressMsg}</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                金牌教研顾问正在策划备课，分析重点，并组织幻灯片排版，请稍候片刻...
              </p>
              <div className="w-64 bg-slate-200 h-1.5 rounded-full mt-5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full animate-[shimmer_1.5s_infinite] w-2/3"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  ✍️ 请输入微课授课主题或大纲
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <input
                    type="text"
                    maxLength={100}
                    value={topicPrompt}
                    onChange={(e) => setTopicPrompt(e.target.value)}
                    placeholder="例如: 小学三年级数学-有余数的除法, 或者 环保概念课: 垃圾分类起步"
                    className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden ring-emerald-500/20 focus:ring-2 focus:border-emerald-500 text-slate-800 font-medium placeholder-slate-400"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    <BookOpen className="h-5 h-5 text-slate-300" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    📏 规划微课页面数 (PPT页)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 5, 8, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSlideCount(num)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                          slideCount === num
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {num} 页
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    🎙️ 授课风格与配音口吻
                  </label>
                  <select
                    value={teachingTone}
                    onChange={(e) => setTeachingTone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="standard">金牌特级讲师 • 专业亲切</option>
                    <option value="humorous">风趣脱口秀 • 趣味活泼</option>
                    <option value="kids">小学幼儿园 • 温馨可爱</option>
                    <option value="story">连环画故事 • 设问引导</option>
                    <option value="academic">高校研究学者 • 逻辑严密</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-700/10 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  一键生成AI备课大纲 + 教师台词
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
