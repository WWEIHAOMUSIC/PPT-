import React, { useState } from "react";
import { Slide, ThemeStyleId } from "../types";
import { THEME_PRESETS, getThemePreset } from "../data/themes";
import { Edit2, Plus, Minus, Palette, FileEdit, Image as ImageIcon, Upload, Eye, EyeOff, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SlideEditorProps {
  slide: Slide;
  activeThemeId: ThemeStyleId;
  onUpdateSlide: (update: Partial<Slide>) => void;
  onUpdateTheme: (themeId: ThemeStyleId) => void;
}

export default function SlideEditor({
  slide,
  activeThemeId,
  onUpdateSlide,
  onUpdateTheme,
}: SlideEditorProps) {
  const currentTheme = getThemePreset(activeThemeId);
  const [newBulletText, setNewBulletText] = useState("");

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSlide({ title: e.target.value });
  };

  const handleSubtitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSlide({ subtitle: e.target.value });
  };

  const handleBulletChange = (idx: number, newVal: string) => {
    const updatedContent = [...slide.content];
    updatedContent[idx] = newVal;
    onUpdateSlide({ content: updatedContent });
  };

  const handleDeleteBullet = (idx: number) => {
    const updatedContent = slide.content.filter((_, i) => i !== idx);
    onUpdateSlide({ content: updatedContent });
  };

  const handleAddBulletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBulletText.trim()) {
      onUpdateSlide({ content: [...slide.content, newBulletText.trim()] });
      setNewBulletText("");
    }
  };

  // Convert uploaded image file into lightweight base64 format offline
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onUpdateSlide({
            backgroundImage: reader.result,
            backgroundMode: "image",
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Instant AI theme/background image generator matching educational topics
  const handleAIAutoSuggestBg = () => {
    const titleText = (slide.title || "").toLowerCase();
    let selectedBg = "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=1200"; // Bookshelf
    
    if (titleText.includes("光合") || titleText.includes("植物") || titleText.includes("绿") || titleText.includes("生态") || titleText.includes("大自然") || titleText.includes("生命") || titleText.includes("森林")) {
      selectedBg = "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=1200"; // Forest morning sun
    } else if (titleText.includes("算") || titleText.includes("机") || titleText.includes("数字") || titleText.includes("电") || titleText.includes("科技") || titleText.includes("现代") || titleText.includes("代码") || titleText.includes("智能")) {
      selectedBg = "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1200"; // Cyan digital grid
    } else if (titleText.includes("数") || titleText.includes("几何") || titleText.includes("公式") || titleText.includes("算术") || titleText.includes("加减") || titleText.includes("除法")) {
      selectedBg = "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=1200"; // Math slate background
    } else if (titleText.includes("史") || titleText.includes("古") || titleText.includes("文") || titleText.includes("艺") || titleText.includes("国学") || titleText.includes("诗")) {
      selectedBg = "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=1200"; // Vintage scroll texture
    } else {
      // General friendly classrooms backdrops
      const fallbacks = [
        "https://images.unsplash.com/photo-1510070112810-d4e9a46d9e91?auto=format&fit=crop&q=80&w=1200", // Sunny wooden table
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=1200", // Stacked colorful books
        "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=1200"  // Classroom blackboard bokeh
      ];
      selectedBg = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    onUpdateSlide({
      backgroundImage: selectedBg,
      backgroundMode: "image",
    });
  };

  const isImageMode = slide.backgroundMode === "image";
  const displayOverlay = slide.showOverlayText !== false;

  return (
    <div className="flex-1 flex flex-col p-6 bg-slate-100 overflow-y-auto">
      {/* Theme Presets bar */}
      <div className="mb-5 bg-white p-4 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Palette className="w-4.5 h-4.5 text-emerald-600" />
          <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">选择课件视觉风格 (自适应模版)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {THEME_PRESETS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onUpdateTheme(t.id);
                // Switch off custom images to let custom CSS layout shine
                onUpdateSlide({ backgroundMode: "theme" });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                activeThemeId === t.id && !isImageMode
                  ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                  : "bg-slate-50 hover:bg-slate-150 border-slate-200 text-slate-600"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full border border-black/10 inline-block ${
                t.id === "tech-blue" ? "bg-cyan-500" :
                t.id === "chalkboard-dark" ? "bg-emerald-800" :
                t.id === "forest-green" ? "bg-emerald-200" :
                t.id === "warm-sunshine" ? "bg-amber-400" :
                t.id === "crimson-editorial" ? "bg-red-700" : "bg-white"
              }`} />
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Live Presentation Stage (16:9 format Frame) */}
      <div className="flex-1 max-w-4xl w-full mx-auto flex items-center justify-center p-2">
        <div className="w-full aspect-[16/9] max-w-3xl rounded-2xl overflow-hidden shadow-2xl relative border-4 border-slate-800/90 flex flex-col transition-all duration-300">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${slide.id}-${activeThemeId}-${slide.backgroundMode}-${slide.backgroundImage}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className={`w-full h-full p-8 md:p-12 flex flex-col justify-between select-none relative ${currentTheme.fontFamily} ${
                isImageMode && slide.backgroundImage
                  ? "bg-cover bg-center text-white"
                  : currentTheme.background
              }`}
              style={
                isImageMode && slide.backgroundImage
                  ? { backgroundImage: `url(${slide.backgroundImage})` }
                  : undefined
              }
            >
              {/* Cover dark blur to protect text overlays readability if image background is active */}
              {isImageMode && slide.backgroundImage && (
                <div className="absolute inset-0 bg-slate-950/45 pointer-events-none z-0" />
              )}

              {/* Theme Decors (Only when in code theme mode) */}
              {!isImageMode && activeThemeId === "tech-blue" && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.06),transparent)] pointer-events-none" />
              )}
              {!isImageMode && activeThemeId === "forest-green" && (
                <div className="absolute top-4 right-6 text-emerald-800/10 font-serif text-[100px] pointer-events-none">🌿</div>
              )}
              {!isImageMode && activeThemeId === "chalkboard-dark" && (
                <div className="absolute bottom-4 right-6 text-white/5 font-mono text-[70px] pointer-events-none">f(x)=√2</div>
              )}

              {/* Slide Top Section */}
              <div className={`space-y-2 z-10 transition-opacity duration-300 ${
                isImageMode && !displayOverlay ? "opacity-15 hover:opacity-100" : "opacity-100"
              }`}>
                <span className={`text-[10px] uppercase tracking-widest font-extrabold px-2.5 py-0.5 rounded-full inline-block ${
                  isImageMode ? "bg-white/10 text-white border border-white/20" : `${currentTheme.accentBg} ${currentTheme.accentText}`
                }`}>
                  MODULE • 第 {slide.title ? slide.title.substring(0, 4) : "X"} 板块
                </span>
                
                {/* Visual Title */}
                <h2 className={`text-2xl md:text-3.5xl font-extrabold tracking-tight mt-1 leading-snug ${
                  isImageMode ? "text-white" : currentTheme.titleColor
                }`}>
                  {slide.title || "点击下方输入标题内容"}
                </h2>
                
                {slide.subtitle && (
                  <p className={`text-xs font-semibold mt-0.5 max-w-sm italic ${isImageMode ? "text-white/80" : "opacity-75"}`}>
                    {slide.subtitle}
                  </p>
                )}
              </div>

              {/* Slide Body / Bullet points layout */}
              <div className={`flex-1 flex flex-col justify-center my-6 md:my-8 z-10 transition-opacity duration-300 ${
                isImageMode && !displayOverlay ? "opacity-10" : "opacity-100"
              }`}>
                {slide.content.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-300/40 rounded-xl">
                    <p className="text-sm opacity-50 font-medium text-slate-400">幻灯片内页纲要为空。在下方编辑器中添加知识要点</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5 max-w-2xl">
                    {slide.content.map((point, i) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                          isImageMode
                            ? "bg-white/10 border border-white/10 text-white backdrop-blur-xs"
                            : currentTheme.cardStyle
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-md font-bold text-xs flex items-center justify-center mt-0.5 shrink-0 ${
                          isImageMode ? "bg-emerald-500 text-white" : `${currentTheme.accentBg} ${currentTheme.accentText}`
                        }`}>
                          {i + 1}
                        </span>
                        <p className={`text-sm tracking-wide font-medium leading-relaxed ${isImageMode ? "text-white/90" : currentTheme.textColor}`}>
                          {point}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Hint overlay for hide state */}
              {isImageMode && !displayOverlay && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
                  <div className="bg-slate-900/90 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold shadow-2xl backdrop-blur-md">
                    <EyeOff className="w-4 h-4 text-emerald-400" />
                    <span>【纯图模式 • 播放微课时仅展示图片不显示蒙层文字】</span>
                  </div>
                </div>
              )}

              {/* Slide Screen Footer info */}
              <div className="flex items-center justify-between border-t border-slate-400/10 pt-4 text-[10px] opacity-65 font-medium z-10 text-slate-400">
                <span>微课名师学堂主创课件</span>
                <span>AI智能辅助生成演示系统</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Slide Text Content Editor Area */}
      <div className="mt-6 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <FileEdit className="w-4.5 h-4.5 text-emerald-600" />
          <h3 className="font-extrabold text-sm text-slate-800">幻灯片课件内容细化编辑（实时同步）</h3>
        </div>

        {/* Bento Box Columns split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Column A: Title parameters & Upload Background image */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">🔤 幻灯片精简标题</label>
                <input
                  type="text"
                  maxLength={25}
                  value={slide.title}
                  onChange={handleTitleChange}
                  placeholder="例如：光合作用机制"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">📝 辅助副标题 (可选)</label>
                <input
                  type="text"
                  maxLength={35}
                  value={slide.subtitle || ""}
                  onChange={handleSubtitleChange}
                  placeholder="例如：初中生物七年级上册重难点讲解"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* NEW: Slide custom background settings panel */}
            <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-750 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  🖼️ 幻灯片专属背景图/PPT截图
                </span>
                
                {/* Mode Select toggle tab */}
                <div className="inline-flex bg-slate-200/60 rounded-lg p-0.5 text-[10px] font-bold">
                  <button
                    onClick={() => onUpdateSlide({ backgroundMode: "theme" })}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      !isImageMode
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    系统彩膜
                  </button>
                  <button
                    onClick={() => onUpdateSlide({ backgroundMode: "image" })}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      isImageMode
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    图片/PPT
                  </button>
                </div>
              </div>

              {isImageMode && (
                <div className="space-y-3 animate-[fadeIn_0.2s_ease-out]">
                  {/* File Upload Selector and API grounding */}
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => document.getElementById("slide-bg-upload-input")?.click()}
                      className="flex-1 py-2.5 px-3 border border-dashed border-emerald-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/10 font-bold text-xs text-emerald-700 hover:text-emerald-800 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      上传PPT截图/底片
                    </button>
                    <input
                      id="slide-bg-upload-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBgImageUpload}
                    />

                    <button
                      type="button"
                      onClick={handleAIAutoSuggestBg}
                      className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 font-bold text-xs text-white rounded-lg transition-all flex items-center justify-center gap-1.5"
                      title="AI全自动根据课题匹配匹配相关高清插图/背景板"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-450" />
                      AI 匹配高清配图
                    </button>
                  </div>

                  {/* Built-in quick shortcuts of education scenery */}
                  <div className="space-y-1">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">推荐精美课堂底纸 (点击一键换底)</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { label: "森林🌿", url: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=1200" },
                        { label: "科技🛰️", url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1200" },
                        { label: "黑板📐", url: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=1200" },
                        { label: "书籍📖", url: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=1200" },
                        { label: "微距🌱", url: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&q=80&w=1200" }
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => onUpdateSlide({ backgroundImage: item.url, backgroundMode: "image" })}
                          className={`py-1 rounded-md text-[10px] font-semibold border transition-all ${
                            slide.backgroundImage === item.url
                              ? "bg-emerald-50 border-emerald-500 text-emerald-700 font-black shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggle view overlay */}
                  <div className="flex items-center justify-between border-t border-slate-150/80 pt-2 text-[11px] text-slate-600">
                    <span className="font-semibold flex items-center gap-1">
                      {displayOverlay ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                      大纲文字及浮动微卡覆盖
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateSlide({ showOverlayText: !displayOverlay })}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                        displayOverlay
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {displayOverlay ? "显示文字" : "隐藏文字 (纯PPT)"}
                    </button>
                  </div>
                </div>
              )}

              {!isImageMode && (
                <div className="py-1 text-center font-medium text-[10px] text-slate-400 leading-relaxed">
                  当前处于标准【系统彩膜配色模式】。选用上方
                  <span className="font-bold text-slate-500 mx-1">幻灯片视觉风格</span>
                  卡片可一键在黑板、科技、温暖、创意等名家专属黑板氛围里平滑切换。
                </div>
              )}
            </div>
          </div>

          {/* Column B: Bullets Editor */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-2">📌 幻灯片内页知识大纲行 ({slide.content.length})</label>
            <div className="space-y-2.5">
              {slide.content.map((point, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    maxLength={50}
                    value={point}
                    onChange={(e) => handleBulletChange(idx, e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10"
                    placeholder={`输入第 ${idx + 1} 个纲要点内容...`}
                  />
                  <button
                    onClick={() => handleDeleteBullet(idx)}
                    className="p-2.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg transition-colors border border-transparent hover:border-rose-200/50"
                    title="删除此要点"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add Bullet points Form */}
              <form onSubmit={handleAddBulletSubmit} className="flex items-center gap-2 pt-1.5">
                <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 font-bold text-sm flex items-center justify-center shrink-0">+</span>
                <input
                  type="text"
                  maxLength={50}
                  value={newBulletText}
                  onChange={(e) => setNewBulletText(e.target.value)}
                  placeholder="追加新的课件大纲解析要点..."
                  className="flex-1 bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!newBulletText.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg text-xs transition-colors shrink-0 flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
