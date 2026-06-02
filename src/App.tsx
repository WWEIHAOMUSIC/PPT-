import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import PPTXLoader from "./components/PPTXLoader";
import SlideThumbnailList from "./components/SlideThumbnailList";
import SlideEditor from "./components/SlideEditor";
import ScriptController from "./components/ScriptController";
import MiniPlayerAndRecorder from "./components/MiniPlayerAndRecorder";
import { Slide, ThemeStyleId, VoiceSettings } from "./types";
import { THEME_PRESETS } from "./data/themes";
import { Video, Sparkles, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [projectTitle, setProjectTitle] = useState("未命名微课课件");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<ThemeStyleId>("tech-blue");
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [showPlayer, setShowPlayer] = useState(false);
  
  // Default Voice configuration
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    gender: "female",
    voiceName: "",
    speed: 1.0,
    pitch: 1.0,
    bgmId: "none",
    bgmVolume: 0.35,
    avatarId: "emily",
  });

  // Load sample template slides if the user requests it or has empty
  const loadDemoClasses = () => {
    const demoSlides: Slide[] = [
      {
        id: "demo-1",
        title: "大自然的神奇法宝:光合作用",
        content: [
          "光合作用是地球上最伟大的化学反应",
          "主要发生场所：植物绿色叶片中的叶绿体",
          "核心反应物：二氧化碳、水与源源不断的太阳能"
        ],
        subtitle: "小学五年级自然科学公开课讲解",
        script: "同学们大家好！今天我们一起来揭开大自然最神奇的能量魔法——光合作用的奥秘。大家都知道绿色的植物会制造氧气，它们是怎么做到的呢？这就要靠它们叶片里，像绿色工厂一样的叶绿体，源源不断地变魔术啦。我们一起去瞧一瞧。",
        duration: 25,
        backgroundImage: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=1200",
        backgroundMode: "image",
        showOverlayText: true,
      },
      {
        id: "demo-2",
        title: "三大关键原料必不可少",
        content: [
          "原料一: 根系吸收的水分由输导组织运往全身",
          "原料二: 空气中自由漂浮的二氧化碳通过气孔吸入",
          "驱动源: 天空中炙热的太阳光线提供澎湃动能"
        ],
        subtitle: "原料的运输与微观捕捉机制",
        script: "那么，这个绿色魔术工厂，需要准备哪些原材料呢？主要有三样：第一样是根系努力吸上来的水分；第二样是潜入叶片小孔里的二氧化碳气体；而最关键的是阳光，它为工厂运转提供了所有动力！",
        duration: 20,
        backgroundImage: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=1200",
        backgroundMode: "image",
        showOverlayText: true,
      },
      {
        id: "demo-3",
        title: "产物转化与丰硕果实",
        content: [
          "产物一: 制造葡萄糖等富能有机物滋养植株",
          "产物二: 生产出清新的氧气分子反馈给大自然",
          "对地球的伟大影响: 维系大气和暖的碳氧平衡"
        ],
        subtitle: "光合作用的产物与深刻生态学意义",
        script: "配料准备好了，魔术开始！在叶绿体里加工后，植物会生产出丰盛的有机糖，喂饱自己，同时释放出我们呼吸必须的氧气。正是光合作用，让我们的地球充满绿意、充满生机！大家懂了吗？",
        duration: 22,
        backgroundImage: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&q=80&w=1200",
        backgroundMode: "image",
        showOverlayText: true,
      }
    ];

    setSlides(demoSlides);
    setProjectTitle("光合作用机制 - AI微课教学示范课");
    setActiveThemeId("forest-green");
    setCurrentSlideIdx(0);
  };

  // Convert raw parser slides into standard Slide object formats
  const handleSlidesLoaded = (loadedSlides: any[], title: string, tone?: string) => {
    const formattedSlides: Slide[] = loadedSlides.map((item, idx) => {
      const scriptText = item.script || `针对${item.title}，我们将讲解以下几点核心知识：${item.content?.join("；") || "相关主题细节"}`;
      return {
        id: `slide-${Date.now()}-${idx}`,
        title: item.title || `第 ${idx + 1} 页幻灯`,
        content: Array.isArray(item.content) ? item.content : ["双击或下方编辑幻灯片行"],
        subtitle: item.subtitle || "",
        script: scriptText,
        duration: Math.max(3, Math.ceil(scriptText.length / 4.2)), // estimate speaking seconds Pacing
      };
    });

    setSlides(formattedSlides);
    setProjectTitle(title || "点击命名您的微课课件");
    setCurrentSlideIdx(0);
  };

  const handleUpdateSlide = (update: Partial<Slide>) => {
    const updated = [...slides];
    updated[currentSlideIdx] = { ...updated[currentSlideIdx], ...update };
    setSlides(updated);
  };

  const handleUpdateVoiceSettings = (update: Partial<VoiceSettings>) => {
    setVoiceSettings((prev) => ({ ...prev, ...update }));
  };

  const handleAddSlide = () => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: "新课件研讨页",
      content: ["新增的知识大纲一", "新增的教法展示点二"],
      subtitle: "双击这里添加章节说明",
      script: "点击右侧讲稿框，为幻灯片添加生动的录课台词解说。输入大洋大纲一、大纲二的具体解释。",
      duration: 10,
    };
    
    const updated = [...slides];
    updated.splice(currentSlideIdx + 1, 0, newSlide);
    setSlides(updated);
    setCurrentSlideIdx(currentSlideIdx + 1);
  };

  const handleDeleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const updated = slides.filter((_, i) => i !== idx);
    setSlides(updated);
    // Boundary guards
    if (currentSlideIdx >= updated.length) {
      setCurrentSlideIdx(updated.length - 1);
    }
  };

  const handleMoveSlide = (idx: number, direction: "up" | "down") => {
    const nextIdx = direction === "up" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= slides.length) return;

    const updated = [...slides];
    const temp = updated[idx];
    updated[idx] = updated[nextIdx];
    updated[nextIdx] = temp;

    setSlides(updated);
    setCurrentSlideIdx(nextIdx);
  };

  const handleResetWorkspace = () => {
    if (confirm("确定要清空当前工作区，重新开始上传课件或由 AI 一键建课吗？")) {
      setSlides([]);
      setProjectTitle("未命名微课课件");
      setActiveThemeId("tech-blue");
      setCurrentSlideIdx(0);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-800">
      
      {/* 1. Header component */}
      <Header
        projectTitle={projectTitle}
        onRenameProject={(title) => setProjectTitle(title)}
        onReset={handleResetWorkspace}
      />

      {/* 2. Main content container split based on Slides status */}
      <div className="flex-1 overflow-hidden">
        {slides.length === 0 ? (
          /* Landing screen: No slides loaded yet */
          <div className="h-full overflow-y-auto px-6 py-8">
            <PPTXLoader onSlidesLoaded={handleSlidesLoaded} />

            {/* Quick Demo Loader Trigger */}
            <div className="max-w-md mx-auto text-center mt-6">
              <span className="text-xs text-slate-400">没有带PPT课件？没关系，试试</span>
              <button
                onClick={loadDemoClasses}
                className="ml-1.5 inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-all"
              >
                <BookOpen className="w-3.5 h-3.5" />
                加载《大自然的光合作用》课件模版
              </button>
            </div>
          </div>
        ) : (
          /* Dashboard columns: PPT loaded, showing workspaces workspace */
          <div className="flex h-full overflow-hidden relative">
            
            {/* Left sidebar: Thumbnails */}
            <SlideThumbnailList
              slides={slides}
              currentIdx={currentSlideIdx}
              onSelectSlide={(idx) => setCurrentSlideIdx(idx)}
              onAddSlide={handleAddSlide}
              onDeleteSlide={handleDeleteSlide}
              onMoveSlide={handleMoveSlide}
            />

            {/* Middle panel: Live Whiteboard Designer & Bullets editor */}
            <SlideEditor
              slide={slides[currentSlideIdx]}
              activeThemeId={activeThemeId}
              onUpdateSlide={handleUpdateSlide}
              onUpdateTheme={(themeId) => setActiveThemeId(themeId)}
            />

            {/* Right sidebar: AI script writing, voices customizer */}
            <ScriptController
              slide={slides[currentSlideIdx]}
              voiceSettings={voiceSettings}
              onUpdateSlide={handleUpdateSlide}
              onUpdateVoiceSettings={handleUpdateVoiceSettings}
            />

            {/* Exporter Floating Action Button (Cinema trigger) */}
            <div className="absolute bottom-6 right-84 z-35 select-none">
              <button
                onClick={() => setShowPlayer(true)}
                className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 hover:from-emerald-700 hover:to-cyan-600 text-white font-extrabold text-sm rounded-full shadow-lg hover:shadow-xl shadow-emerald-500/20 tracking-wider transition-all duration-300 hover:scale-[1.03] animate-[pulse_2s_infinite]"
                title="导出或播放此微课录像"
              >
                <Video className="w-5 h-5 animate-pulse" />
                <span>生成 & 播放录像视频</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Global Full-Screen Player Overlay Modal */}
      <AnimatePresence>
        {showPlayer && slides.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-hidden"
          >
            <MiniPlayerAndRecorder
              slides={slides}
              voiceSettings={voiceSettings}
              activeThemeId={activeThemeId}
              onClose={() => setShowPlayer(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
