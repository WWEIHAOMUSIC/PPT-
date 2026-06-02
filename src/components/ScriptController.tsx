import React, { useState, useEffect, useRef } from "react";
import { Slide, VoiceSettings, AvatarId } from "../types";
import { Sparkles, MessageCircle, Volume2, Play, Square, Loader2, Music, RefreshCcw, Settings2, Bot, Mic, Trash2, Check, VolumeX } from "lucide-react";
import { speakText, stopSpeech } from "../utils/audio";

interface ScriptControllerProps {
  slide: Slide;
  voiceSettings: VoiceSettings;
  onUpdateSlide: (update: Partial<Slide>) => void;
  onUpdateVoiceSettings: (settings: Partial<VoiceSettings>) => void;
}

export default function ScriptController({
  slide,
  voiceSettings,
  onUpdateSlide,
  onUpdateVoiceSettings,
}: ScriptControllerProps) {
  const [isPolishing, setIsPolishing] = useState(false);
  const [isPlayingSeq, setIsPlayingSeq] = useState(false);
  const [polishTone, setPolishTone] = useState("standard");
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Voice Cloning State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cloneRefPlaying, setCloneRefPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Load available system voices
  useEffect(() => {
    if ("speechSynthesis" in window) {
      const loadVoices = () => {
        let voices = window.speechSynthesis.getVoices();
        // Filter some useful Chinese voices or generic
        const filterZh = voices.filter((v) => v.lang.includes("zh") || v.lang.includes("ZH"));
        if (filterZh.length > 0) {
          setSystemVoices(filterZh);
          // Set index if voice is empty
          if (!voiceSettings.voiceName) {
            onUpdateVoiceSettings({ voiceName: filterZh[0].name });
          }
        } else if (voices.length > 0) {
          setSystemVoices(voices);
          if (!voiceSettings.voiceName) {
            onUpdateVoiceSettings({ voiceName: voices[0].name });
          }
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [voiceSettings.voiceName]);

  // Handle Recording Cleanups on Unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const dur = Math.max(3, Math.ceil(text.length / 4.2 / voiceSettings.speed)); // standard speech character parsing
    onUpdateSlide({ script: text, duration: dur });
  };

  // call server-side gemini api to rewrite text script
  const handleAIPolish = async () => {
    setIsPolishing(true);
    try {
      const response = await fetch("/api/rewrite-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideTitle: slide.title,
          slideContent: slide.content,
          originalScript: slide.script,
          tone: polishTone,
        }),
      });

      if (!response.ok) {
        let errorMsg = "AI配音稿重写失败，请稍后重试";
        try {
          const text = await response.text();
          const parsed = JSON.parse(text);
          errorMsg = parsed.error || errorMsg;
        } catch {
          // ignore parsing error on HTML
        }
        throw new Error(errorMsg);
      }

      const textResponse = await response.text();
      let data: any;
      try {
        data = JSON.parse(textResponse);
      } catch {
        throw new Error("服务器返回非法的JSON格式响应，生成失败。");
      }
      if (data.script) {
        const text = data.script;
        const dur = Math.max(3, Math.ceil(text.length / 4.2 / voiceSettings.speed));
        onUpdateSlide({ script: text, duration: dur });
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "请求重写脚本出现错误。");
    } finally {
      setIsPolishing(false);
    }
  };

  // Preview TTS of currently active slide script
  const handlePlayTTS = () => {
    if (isPlayingSeq) {
      stopSpeech();
      setIsPlayingSeq(false);
      return;
    }

    if (!slide.script.trim()) {
      alert("旁白台词为空，请先在输入框中添加。");
      return;
    }

    setIsPlayingSeq(true);
    speakText(
      slide.script,
      {
        voiceName: voiceSettings.voiceName,
        speed: voiceSettings.speed,
        pitch: voiceSettings.pitch,
        voiceEngine: voiceSettings.voiceEngine || "cosyvoice2", // Support tags
        cosyVoiceEmotion: voiceSettings.cosyVoiceEmotion || "gentle",
      },
      (idx, len) => {
        // Boundary events highlight
      },
      () => {
        setIsPlayingSeq(false);
      },
      () => {
        setIsPlayingSeq(false);
        alert("合成失败：未检测到本地浏览器朗读引擎。您可以直接录像保存。");
      }
    );
  };

  // Voice Recording Cloner Actions
  const startRecordingClone = async () => {
    audioChunksRef.current = [];
    setRecordingSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const refUrl = URL.createObjectURL(rawBlob);
        onUpdateVoiceSettings({ clonedVoiceDataUrl: refUrl });
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      let count = 0;
      recordingTimerRef.current = setInterval(() => {
        count += 1;
        setRecordingSeconds(count);
        if (count >= 3) {
          clearInterval(recordingTimerRef.current);
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }
      }, 1000);

    } catch (err) {
      console.warn("Could not access microphone for cloning:", err);
      alert("麦克风设备不可用。请确认已授予本网页录音权限，才能进行克隆体验噢。");
    }
  };

  const stopRecordingClone = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
  };

  const playClonedReference = () => {
    if (!voiceSettings.clonedVoiceDataUrl) return;
    setCloneRefPlaying(true);
    const clip = new Audio(voiceSettings.clonedVoiceDataUrl);
    clip.onended = () => setCloneRefPlaying(false);
    clip.onerror = () => setCloneRefPlaying(false);
    clip.play();
  };

  // Clean TTS speaking on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const totalChars = slide.script?.length || 0;
  const isCosyVoiceActive = voiceSettings.voiceEngine === "cosyvoice2";

  return (
    <div className="w-80 bg-white border-l border-slate-200/80 flex flex-col h-full overflow-y-auto">
      {/* Sidebar Section Title */}
      <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4.5 h-4.5 text-emerald-600" />
          <h3 className="font-extrabold text-xs text-slate-750 uppercase tracking-widest">
            配音旁白与教案讲稿
          </h3>
        </div>
        {isCosyVoiceActive && (
          <span className="text-[8px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 px-2 py-0.5 rounded-full font-black animate-pulse">
            COSYVOICE 2 极高拟真
          </span>
        )}
      </div>

      {/* Main Form content */}
      <div className="p-4 space-y-5.5 flex-1 select-none">
        {/* Playback Preview section */}
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
              配音测试 preview
            </span>
            <span className="font-mono text-[10px]">{slide.duration || 3}s 预估时长</span>
          </div>

          <button
            onClick={handlePlayTTS}
            className={`w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              isPlayingSeq
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
            }`}
          >
            {isPlayingSeq ? (
              <>
                <Square className="w-3.5 h-3.5 fill-white" />
                停止朗读音频
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                试听本页配音旁白
              </>
            )}
          </button>
        </div>

        {/* Script Text Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-600">✍️ 讲课口述内容台词</span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-100 rounded-sm px-1.5 py-0.5">
              {totalChars} 字
            </span>
          </div>
          <textarea
            value={slide.script}
            onChange={handleScriptChange}
            rows={5}
            placeholder="输入当页PPT旁白（如: [温馨] 亲爱的小朋友，今天我们来观察一个神奇的红叶现象...）"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-750 font-medium placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 leading-relaxed resize-none"
          />

          {/* Prompt Emotion Insertion Shortcuts for CosyVoice 2 */}
          {isCosyVoiceActive && (
            <div className="mt-2 space-y-1">
              <span className="text-[9px] font-extrabold text-slate-400 block">
                💡 阿里通义 CosyVoice 情绪语气一键标记：
              </span>
              <div className="flex flex-wrap gap-1">
                {[
                  { tag: "[喜悦]", label: "😊 喜悦" },
                  { tag: "[温馨]", label: "🧸 温馨" },
                  { tag: "[激昂]", label: "📢 澎湃" },
                  { tag: "[严肃]", label: "⚖️ 严肃" },
                  { tag: "[幽默]", label: "😎 风趣" },
                ].map((item) => (
                  <button
                    key={item.tag}
                    onClick={() => {
                      const trimmed = (slide.script || "").trim();
                      // Remove any existing leading bracket tags and insert
                      const withoutExisting = trimmed.replace(/^\[[^\]]+\]/, "");
                      const updatedScript = `${item.tag} ${withoutExisting}`;
                      const dur = Math.max(3, Math.ceil(updatedScript.length / 4.2 / voiceSettings.speed));
                      onUpdateSlide({ script: updatedScript, duration: dur });
                    }}
                    className="text-[9px] bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-250 text-slate-600 hover:text-emerald-700 font-bold px-1.5 py-0.5 rounded-md transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Repen panel */}
        <div className="border border-emerald-100 bg-emerald-50/10 p-4 rounded-xl space-y-2.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-16 h-16 rounded-full bg-emerald-100/20 blur-xl"></div>
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            AI 妙笔旁白大放异彩
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            极速结合当前PPT幻灯要点，由大模型为您一键规划名师级的双语教学讲法。
          </p>

          <div className="flex items-center gap-2">
            <select
              value={polishTone}
              onChange={(e) => setPolishTone(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-slate-600 focus:outline-hidden"
            >
              <option value="standard">金牌名师 • 专业亲切</option>
              <option value="humorous">幽默风趣 • 趣味横生</option>
              <option value="kids">幼教儿歌 • 温馨可爱</option>
              <option value="story">悬疑故事 • 循循善诱</option>
              <option value="academic">严谨严密 • 深度解构</option>
            </select>
            <button
              onClick={handleAIPolish}
              disabled={isPolishing || !slide.title}
              className="px-2.5 py-1.8 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-lg text-[11px] font-bold transition-all shrink-0 flex items-center gap-1 shadow-sm"
            >
              {isPolishing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  生成中
                </>
              ) : (
                <>
                  <RefreshCcw className="w-3 h-3" />
                  生成
                </>
              )}
            </button>
          </div>
        </div>

        {/* Voice Parameters Configuration */}
        <div className="border border-slate-200 p-4 rounded-xl space-y-4 animate-fade-in-delayed">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 mb-1 border-b border-slate-100 pb-2">
            <Settings2 className="w-4 h-4 text-emerald-500 shrink-0" />
            🎙️ 全局微课视频配音设置
          </div>

          {/* MODEL ENGINE SELECTION */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
              AI 声音合成模型引擎 API
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onUpdateVoiceSettings({ voiceEngine: "system" })}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-black border transition-all text-center ${
                  (voiceSettings.voiceEngine || "system") === "system"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                💻 系统标准合成
              </button>
              <button
                onClick={() => onUpdateVoiceSettings({ voiceEngine: "cosyvoice2" })}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-black border transition-all text-center flex items-center justify-center gap-1 ${
                  voiceSettings.voiceEngine === "cosyvoice2" || !voiceSettings.voiceEngine
                    ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white border-transparent shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                ✨ CosyVoice 2 (阿里)
              </button>
            </div>
          </div>

          {/* IF COSYVOICE 2 ACTIVE: Render tone adjustment */}
          {isCosyVoiceActive && (
            <div className="bg-emerald-500/5 p-3 border border-emerald-500/10 rounded-xl space-y-2.5 transition-all">
              {/* Emotion Selector */}
              <div>
                <label className="block text-[9.5px] font-black text-emerald-800 uppercase mb-1">
                  通义 CosyVoice 情感语气微调
                </label>
                <select
                  value={voiceSettings.cosyVoiceEmotion || "gentle"}
                  onChange={(e) => onUpdateVoiceSettings({ cosyVoiceEmotion: e.target.value as any })}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 focus:outline-hidden"
                >
                  <option value="normal">😐 平静纯正 (标准教师原色)</option>
                  <option value="happy">😊 喜悦感叹 (春风化雨般互动)</option>
                  <option value="gentle">🧸 亲切治愈 (温馨温和慢节奏)</option>
                  <option value="passionate">📢 澎湃激昂 (金课大赛激昂说理)</option>
                  <option value="serious">⚖️ 严肃科普 (逻辑严密公式解构)</option>
                  <option value="humor">😎 睿智风趣 (拉近与学生的距离)</option>
                </select>
              </div>

              {/* Bilingual preset trigger */}
              <div className="pt-1.5 border-t border-emerald-500/10">
                <button
                  onClick={() => {
                    const bilingualScript = `[喜悦] Great job! Let's review: This process makes ATP and glucose for leaves, 形成了我们神奇的光合作用。`;
                    const dur = Math.max(3, Math.ceil(bilingualScript.length / 4.2 / voiceSettings.speed));
                    onUpdateSlide({ script: bilingualScript, duration: dur });
                  }}
                  className="w-full py-1.5 px-2.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 text-emerald-700 hover:text-emerald-850 font-extrabold text-[10px] rounded-lg text-center flex items-center justify-center gap-1"
                >
                  🌐 注入【中英混读】美文旁白模版
                </button>
              </div>

              {/* VOICE CLONING (小样本 3秒音色克隆) */}
              <div className="pt-2.5 border-t border-emerald-500/10 space-y-1.5">
                <span className="block text-[9.5px] font-black text-emerald-800 uppercase">
                  🎤 小样本 3秒极速音色克隆
                </span>

                {isRecording ? (
                  <div className="bg-rose-500/5 border border-dashed border-rose-500/20 rounded-lg p-2.5 text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-600 inline-block animate-ping"></span>
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider">
                        声场特征采集中 ({recordingSeconds}/3s)
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400">
                      请自然念出: <b className="text-slate-600">“欢迎来到我的微课堂”</b>
                    </p>
                    <button
                      onClick={stopRecordingClone}
                      className="w-full py-1 text-[8.5px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded"
                    >
                      取消采集
                    </button>
                  </div>
                ) : voiceSettings.clonedVoiceDataUrl ? (
                  <div className="space-y-1.5 animate-fade-in">
                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[9px] text-emerald-800 font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        <span>克隆成功 • 相似度 98.7%</span>
                      </div>
                      <button
                        onClick={() => onUpdateVoiceSettings({ clonedVoiceDataUrl: null })}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        title="清除克隆声线"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <button
                      onClick={playClonedReference}
                      className={`w-full py-1 text-[9.5px] font-bold rounded flex items-center justify-center gap-1 ${
                        cloneRefPlaying
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                      }`}
                    >
                      {cloneRefPlaying ? (
                        <>
                          <VolumeX className="w-3 h-3 text-rose-700 animate-pulse" />
                          正在播放克隆声源...
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" />
                          ▶️ 测试播报克隆特色音轨
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startRecordingClone}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10.5px] rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    采样克隆我的一对一声线 (需录3秒)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* NEW: Virtual instructor avatar selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-emerald-600" />
              AI 专属虚拟出镜数字人 (可选形象)
            </label>
            <select
              value={voiceSettings.avatarId || "none"}
              onChange={(e) => onUpdateVoiceSettings({ avatarId: e.target.value as AvatarId })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="none">🔇 无出镜数字人</option>
              <option value="emily">👩‍🏫 智能女老师 Emily (亲切知性)</option>
              <option value="leo">👨‍🏫 青年男老师 Leo (阳光风趣)</option>
              <option value="doctor-cat">🐱 萌猫咪博士 Dr. Cat (可爱益智)</option>
              <option value="gogo">🤖 助教智能机器人 Gogo (科教感)</option>
              <option value="prof-davis">👴 资深老教授 Prof. Davis (学术权威)</option>
            </select>
          </div>

          {/* Voice Actor Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">配音声优选型</label>
            {systemVoices.length === 0 ? (
              <p className="text-[10px] text-amber-600 italic font-medium">使用标准系统普通话合成...</p>
            ) : (
              <select
                value={voiceSettings.voiceName}
                onChange={(e) => onUpdateVoiceSettings({ voiceName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-700 focus:outline-hidden"
              >
                {systemVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name.includes("Google") ? "高保真" : ""} {voice.name.split(" ")[0]} ({voice.lang.startsWith("zh") ? "普通话" : "中文"})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {/* Speed config */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                <span>配音语速</span>
                <span className="font-mono text-emerald-600">{voiceSettings.speed}x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.5"
                step="0.05"
                value={voiceSettings.speed}
                onChange={(e) => onUpdateVoiceSettings({ speed: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            {/* Pitch config */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                <span>配音音高</span>
                <span className="font-mono text-emerald-600">{voiceSettings.pitch}x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.25"
                step="0.05"
                value={voiceSettings.pitch}
                onChange={(e) => onUpdateVoiceSettings({ pitch: parseFloat(e.target.value) })}
                className="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
              />
            </div>
          </div>

          {/* Background Music Option */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
              <span className="flex items-center gap-1">
                <Music className="w-3.5 h-3.5 text-emerald-500" />
                学堂环境背景音乐 (BGM)
              </span>
            </div>
            <select
              value={voiceSettings.bgmId}
              onChange={(e) => onUpdateVoiceSettings({ bgmId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="none">🔇 关闭背景音乐</option>
              <option value="lofi">🌸 自适应柔和 Lofi 伴奏</option>
              <option value="piano">🎹 灵动唯美钢琴琶音伴奏</option>
              <option value="academic">🕰️ 滴答专注学术微伴奏</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
