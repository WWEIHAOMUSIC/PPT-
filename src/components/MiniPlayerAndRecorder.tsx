import React, { useState, useEffect, useRef } from "react";
import { Slide, VoiceSettings, ThemeStyleId, AvatarId } from "../types";
import { getThemePreset } from "../data/themes";
import { Play, Square, Video, Download, X, HelpCircle, Film, Sparkles, CheckCircle, VolumeX, AlertTriangle, Monitor, Bot } from "lucide-react";
import { startProceduralBGM, stopProceduralBGM, speakText, stopSpeech, setBGMVolume } from "../utils/audio";
import { motion, AnimatePresence } from "motion/react";
import AvatarCanvas from "./AvatarCanvas";

interface MiniPlayerAndRecorderProps {
  slides: Slide[];
  voiceSettings: VoiceSettings;
  activeThemeId: ThemeStyleId;
  onClose: () => void;
}

export default function MiniPlayerAndRecorder({
  slides,
  voiceSettings,
  activeThemeId,
  onClose,
}: MiniPlayerAndRecorderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [spokenSubtitle, setSpokenSubtitle] = useState("");
  const [activeHighlightChar, setActiveHighlightChar] = useState({ start: 0, end: 0 });
  const [isTabRecording, setIsTabRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [recordedSize, setRecordedSize] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [playbackComplete, setPlaybackComplete] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const capturedStreamRef = useRef<MediaStream | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playTimerRef = useRef<any>(null);

  // Stop everything on close
  useEffect(() => {
    return () => {
      stopEverything();
    };
  }, []);

  const stopEverything = () => {
    stopSpeech();
    stopProceduralBGM();
    setIsPlaying(false);
    setIsAvatarSpeaking(false);
    setIsTabRecording(false);
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    
    // Stop recording stream if running
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (capturedStreamRef.current) {
      capturedStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  // Play slideshow logic slide-by-slide
  const startSlideshow = async (recordMode: boolean = false) => {
    stopEverything();
    setCurrentSlideIdx(0);
    setIsPlaying(true);
    setSpokenSubtitle("");
    setActiveHighlightChar({ start: 0, end: 0 });
    setRecordingError(null);
    setPlaybackComplete(false);

    // Start background music loop
    startProceduralBGM(voiceSettings.bgmId, voiceSettings.bgmVolume);

    if (recordMode) {
      try {
        // Capture browser tab/screen to record layout and voice audio loopback!
        let stream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: "browser", // Prefer browser tab capture
              width: 1920,
              height: 1080,
              frameRate: 30,
            },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          });
        } catch (initialErr) {
          console.warn("Advanced capture options failed, retrying with simple constraints:", initialErr);
          // Fall back to simple capture in case of browser/device constraints errors
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
        }

        capturedStreamRef.current = stream;
        setIsTabRecording(true);
        setDownloadUrl(null);
        setRecordedChunks([]);

        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") 
            ? "video/webm;codecs=vp9" 
            : "video/webm",
        });

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
            setRecordedChunks([...chunks]);
            setRecordedSize(prev => prev + e.data.size);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          setIsTabRecording(false);
          setIsPlaying(false);
          stopProceduralBGM();

          // Auto trigger standard download prompt immediately to prevent user confusion
          try {
            const tempLink = document.createElement("a");
            tempLink.href = url;
            tempLink.download = "AI微课帮_我的高品质微课视频.webm";
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
          } catch (autoErr) {
            console.warn("Auto download trigger failed, relying on visual screen action key:", autoErr);
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000); // chunk every second

        // If the user cancels standard windows screen picker
        stream.getVideoTracks()[0].onended = () => {
          stopEverything();
        };

      } catch (err: any) {
        console.warn("User cancelled or capture is not supported:", err);
        
        let errorMessage = "录课流初始化受阻。";
        if (err && (err.name === "SecurityError" || err.message?.includes("Permission") || err.message?.includes("disallowed"))) {
          errorMessage = "由于浏览器安全权限策略原因，网页内置 iframe 预览框架无法直接调起录屏。我们将为您引导至新窗口去 100% 完美运行录像！";
        } else if (err && (err.name === "NotAllowedError" || err.message?.includes("cancel") || err.message?.includes("deny"))) {
          errorMessage = "检测到录影权限未授予。请再次点击后，在系统弹窗中勾选【共享标签页/Tab】和【同时共享标签页音频】即可。";
        } else {
          errorMessage = `录频被拦截: ${err?.message || err || ""}`;
        }
        
        setRecordingError(errorMessage);
        stopEverything();
        return;
      }
    }

    // Trigger Slide index playback helper sequential Loop starting at 0
    playSlideByIndex(0);
  };

  const playSlideByIndex = (idx: number) => {
    if (idx >= slides.length) {
      // Completed last slide
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      } else {
        stopEverything();
        setPlaybackComplete(true);
      }
      return;
    }

    setCurrentSlideIdx(idx);
    const slide = slides[idx];
    setSpokenSubtitle(slide.script || "");
    setActiveHighlightChar({ start: 0, end: 0 });

    if (!slide.script || !slide.script.trim()) {
      setIsAvatarSpeaking(false);
      // Blank script fallback time
      playTimerRef.current = setTimeout(() => {
        playSlideByIndex(idx + 1);
      }, (slide.duration || 4) * 1000);
      return;
    }

    setIsAvatarSpeaking(true);

    // Speak text with local TTS engine
    activeUtteranceRef.current = speakText(
      slide.script,
      {
        voiceName: voiceSettings.voiceName,
        speed: voiceSettings.speed,
        pitch: voiceSettings.pitch,
        voiceEngine: voiceSettings.voiceEngine,
        cosyVoiceEmotion: voiceSettings.cosyVoiceEmotion,
      },
      (charIndex, charLength) => {
        // Update live visual subtitles highlight matching speech
        setActiveHighlightChar({ start: charIndex, end: charIndex + charLength });
        setIsAvatarSpeaking(true);
      },
      () => {
        setIsAvatarSpeaking(false);
        // Wait 1.5 seconds for nice pause transitions between slides
        playTimerRef.current = setTimeout(() => {
          playSlideByIndex(idx + 1);
        }, 1500);
      },
      () => {
        setIsAvatarSpeaking(false);
        // Error / TTS cancel fallback timer
        playTimerRef.current = setTimeout(() => {
          playSlideByIndex(idx + 1);
        }, (slide.duration || 5) * 1000);
      }
    );
  };

  const currentSlide = slides[currentSlideIdx] || slides[0];
  const currentTheme = getThemePreset(activeThemeId);

  const isImageMode = currentSlide && currentSlide.backgroundMode === "image";
  const displayOverlay = currentSlide && currentSlide.showOverlayText !== false;

  // Render Subtitles markup on screen with highlighting text details
  const renderSubtitles = () => {
    if (!spokenSubtitle) return <span className="opacity-40">已准备就绪，点击播放生成多媒体教学解说...</span>;
    
    const start = activeHighlightChar.start;
    const end = activeHighlightChar.end;

    if (start === 0 && end === 0) {
      return <span>{spokenSubtitle}</span>;
    }

    const before = spokenSubtitle.substring(0, start);
    const highlight = spokenSubtitle.substring(start, end);
    const after = spokenSubtitle.substring(end);

    return (
      <p className="leading-relaxed">
        {before}
        <span className="bg-amber-400 text-slate-900 border-b-2 border-emerald-600 rounded-sm px-1.5 py-0.5 font-extrabold text-base mx-0.5 shadow-sm transition-all duration-100">
          {highlight}
        </span>
        {after}
      </p>
    );
  };

  // Helper inside video overlay to render the animated visual digital humans
  const renderAvatarSVG = (avatar: AvatarId, isSpeaking: boolean) => {
    const mouthY = isSpeaking ? 53 : 51;
    const mouthH = isSpeaking ? 8 : 3;

    switch (avatar) {
      case "emily":
        return (
          <svg viewBox="0 0 80 80" className="w-full h-full bg-emerald-50">
            {/* Hair back */}
            <path d="M20,45 C20,20, 60,20, 60,45" fill="#474554" />
            <circle cx="40" cy="18" r="10" fill="#474554" />
            {/* Face */}
            <circle cx="40" cy="42" r="18" fill="#FEE2E2" />
            {/* Hair bangs */}
            <path d="M22,32 C30,22 50,22 58,32" fill="#474554" />
            {/* Eyes + Glasses */}
            <circle cx="34" cy="38" r="4" fill="none" stroke="#10B981" strokeWidth="1.5" />
            <circle cx="46" cy="38" r="4" fill="none" stroke="#10B981" strokeWidth="1.5" />
            <line x1="38" y1="38" x2="42" y2="38" stroke="#10B981" strokeWidth="1.5" />
            <circle cx="34" cy="38" r="1.5" fill="#1E293B" />
            <circle cx="46" cy="38" r="1.5" fill="#1E293B" />
            <circle cx="28" cy="45" r="2.5" fill="#F43F5E" opacity="0.4" />
            <circle cx="52" cy="45" r="2.5" fill="#F43F5E" opacity="0.4" />
            {/* Morphing open/close mouth */}
            <rect x="36" y={mouthY - mouthH/2} width="8" height={mouthH} rx="3.5" ry="1.5" fill="#E11D48" />
            {/* Suit */}
            <path d="M22,65 C22,55, 58,55, 58,65 L50,75 L30,75 Z" fill="#0D9488" />
            <path d="M38,58 L42,58 L40,65 Z" fill="#F1F5F9" />
          </svg>
        );
      case "leo":
        return (
          <svg viewBox="0 0 80 80" className="w-full h-full bg-cyan-50">
            {/* Hair back */}
            <path d="M22,38 C22,20, 58,20, 58,38" fill="#1E293B" />
            <circle cx="40" cy="44" r="18" fill="#FFEDD5" />
            {/* Spikes */}
            <path d="M24,28 L32,20 L38,24 L46,18 L52,24 L56,28 L54,34 L26,34 Z" fill="#1E293B" />
            <circle cx="33" cy="41" r="1.5" fill="#0F172A" />
            <circle cx="47" cy="41" r="1.5" fill="#0F172A" />
            <rect x="27" y="37" width="11" height="8" rx="2" fill="none" stroke="#0EA5E9" strokeWidth="1.5" />
            <rect x="42" y="37" width="11" height="8" rx="2" fill="none" stroke="#0EA5E9" strokeWidth="1.5" />
            <line x1="38" y1="41" x2="42" y2="41" stroke="#0EA5E9" strokeWidth="1.5" />
            {/* Morphing mouth */}
            <rect x="36" y={mouthY + 2 - mouthH/2} width="8" height={mouthH} rx="3" ry="1.5" fill="#BE123C" />
            {/* Suit */}
            <path d="M22,65 C22,56 58,56 58,65 Z" fill="#1E40AF" />
            <path d="M34,56 L40,64 L46,56 Z" fill="#F8FAFC" />
            <path d="M38,62 L42,62 L40,75 Z" fill="#EF4444" />
          </svg>
        );
      case "doctor-cat":
        return (
          <svg viewBox="0 0 80 80" className="w-full h-full bg-amber-50/50">
            {/* Ears */}
            <path d="M22,34 L14,14 L30,26 Z" fill="#F97316" />
            <path d="M58,34 L66,14 L50,26 Z" fill="#F97316" />
            <circle cx="40" cy="44" r="19" fill="#F97316" />
            <circle cx="40" cy="44" r="16" fill="#FFEDD5" />
            {/* Scholar hat */}
            <polygon points="40,11 58,17 40,23 22,17" fill="#1E293B" />
            <rect x="34" y="16" width="12" height="6" fill="#1E293B" />
            <line x1="58" y1="17" x2="60" y2="28" stroke="#FBBF24" strokeWidth="1.5" />
            <circle cx="60" cy="28" r="1.5" fill="#FBBF24" />
            {/* Eyes */}
            <circle cx="31" cy="42" r="3" fill="#1E293B" />
            <circle cx="49" cy="42" r="3" fill="#1E293B" />
            <circle cx="32" cy="40" r="1" fill="#FFFFFF" />
            <circle cx="50" cy="40" r="1" fill="#FFFFFF" />
            <polygon points="40,46 37,44 43,44" fill="#E11D48" />
            {isSpeaking ? (
              <circle cx="40" cy="51" r="3.2" fill="#E11D48" />
            ) : (
              <path d="M36,50 Q38,52 40,50 Q42,52 44,50" fill="none" stroke="#27272A" strokeWidth="1.8" />
            )}
          </svg>
        );
      case "gogo":
        return (
          <svg viewBox="0 0 80 80" className="w-full h-full bg-slate-900">
            <line x1="40" y1="20" x2="40" y2="10" stroke="#10B981" strokeWidth="3" />
            <circle cx="40" cy="8" r="3.5" fill="#10B981" className={isSpeaking ? "animate-pulse" : ""} />
            <rect x="12" y="32" width="6" height="18" rx="2" fill="#059669" />
            <rect x="62" y="32" width="6" height="18" rx="2" fill="#059669" />
            <rect x="16" y="22" width="48" height="38" rx="10" fill="#34D399" />
            <rect x="20" y="26" width="40" height="28" rx="6" fill="#064E3B" />
            {isSpeaking ? (
              <>
                <path d="M26,38 L30,34 L34,38" fill="none" stroke="#34D399" strokeWidth="2.5" />
                <path d="M46,38 L50,34 L54,38" fill="none" stroke="#34D399" strokeWidth="2.5" />
              </>
            ) : (
              <>
                <circle cx="30" cy="38" r="3" fill="#10B981" />
                <circle cx="50" cy="38" r="3" fill="#10B981" />
              </>
            )}
            <rect x="26" y="46" width="3" height={isSpeaking ? 6 : 2} fill="#34D399" />
            <rect x="33" y="45" width="3" height={isSpeaking ? 8 : 2} fill="#34D399" />
            <rect x="40" y="46" width="3" height={isSpeaking ? 9 : 2} fill="#34D399" />
            <rect x="47" y="45" width="3" height={isSpeaking ? 8 : 2} fill="#34D399" />
            <rect x="54" y="46" width="3" height={isSpeaking ? 6 : 2} fill="#34D399" />
          </svg>
        );
      case "prof-davis":
        return (
          <svg viewBox="0 0 80 80" className="w-full h-full bg-slate-50">
            <path d="M20,44 C20,20, 60,20, 60,44" fill="#94A3B8" />
            <circle cx="40" cy="43" r="18" fill="#FEE2E2" />
            <circle cx="34" cy="39" r="4.5" fill="none" stroke="#2C3E50" strokeWidth="1.5" />
            <circle cx="46" cy="39" r="4.5" fill="none" stroke="#2C3E50" strokeWidth="1.5" />
            <line x1="38.5" y1="39" x2="41.5" y2="39" stroke="#2C3E50" strokeWidth="1.5" />
            <circle cx="34" cy="39" r="1" fill="#0F172A" />
            <circle cx="46" cy="39" r="1" fill="#0F172A" />
            <path d="M25,48 C25,62, 55,62, 55,48 Z" fill="#CBD5E1" />
            <rect x="36" y={mouthY + 1 - mouthH/2} width="8" height={mouthH} rx="3" fill="#991B1B" />
            <path d="M22,65 C22,56, 58,56, 58,65 Z" fill="#334155" />
            <path d="M34,56 L40,64 L46,56 Z" fill="#E2E8F0" />
            <path d="M38,62 L42,62 L40,75 Z" fill="#0284C7" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getAvatarName = (avatar: AvatarId) => {
    switch (avatar) {
      case "emily": return "主讲 Emily 老师";
      case "leo": return "主讲 Leo 老师";
      case "doctor-cat": return "萌宠 喵博士";
      case "gogo": return "智酷机器人 Gogo";
      case "prof-davis": return "特级 Davis 教授";
      default: return "";
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 text-white rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl max-w-5xl w-full flex flex-col md:flex-row h-[85vh]">
        
        {/* Left Side: Dynamic Virtual 1080P Player Console */}
        <div className="flex-1 flex flex-col p-6 border-b border-slate-800 md:border-b-0 md:border-r border-slate-800/80 bg-slate-950">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-emerald-400" />
              <h3 className="font-extrabold text-sm tracking-widest uppercase text-slate-100">
                1080P 微课播放录制剧场
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              {isTabRecording ? "录制捕获中 • 视频流输出" : isPlaying ? "演示播放中 • AI仿真台词" : "待播放中"}
            </div>
          </div>

          {/* Calibrated slideshow rendering screen */}
          <div className="flex-1 aspect-[16/9] bg-black border border-slate-800/50 rounded-xl overflow-hidden shadow-2xl relative flex items-center justify-center">
            {recordingError ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center z-45 overflow-y-auto select-none"
              >
                <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-3 animate-pulse">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <h3 className="text-base md:text-lg font-black text-white px-2">
                  ⚠️ 录制被拦截：需要开启安全授权
                </h3>
                <p className="text-xs text-slate-300 mt-2 max-w-lg leading-relaxed px-4">
                  这是浏览器的<b>跨标签页沙箱机制</b>安全防护限制。由于目前网页正作为<b>嵌套框架/iframe</b>在 AI Studio 开发者控制台中预览，浏览器默认自动拦截内置录屏请求。
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5 mt-5 w-full max-w-lg px-4">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Monitor className="w-4 h-4 stroke-[2.5]" />
                    🚀 在新标签页中单独打开（100%成功）
                  </a>
                  <button
                    onClick={() => {
                      setRecordingError(null);
                      startSlideshow(false);
                    }}
                    className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-700/50 flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-200" />
                    继续本地免录预览
                  </button>
                </div>

                <div className="mt-4 bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 max-w-lg text-left text-[10px] text-slate-400 leading-normal font-semibold">
                  <span className="text-yellow-400 font-bold block mb-0.5">💡 新手极速录制教程</span>
                  点击绿色大按钮单独在新窗口打开后：
                  <ul className="list-disc list-inside space-y-0.5 mt-0.5 text-slate-400">
                    <li>再次点击“同步录像”，此时即可成功唤出浏览器录制框</li>
                    <li>在选项卡中选择<b>【当前标签页 / This Tab】</b>并<b>勾选【共享标签页音频】</b></li>
                    <li>点击开始共享后，系统将全自动播放，完成后便能完美生成支持下载的多媒体微课！</li>
                  </ul>
                </div>
              </motion.div>
            ) : playbackComplete ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-gradient-to-br from-slate-950 via-teal-950/20 to-slate-950 flex flex-col items-center justify-center p-6 text-center z-45 overflow-y-auto select-none"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3 animate-bounce">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-white px-2">
                  🎉 庆祝！课件智能演示播放完毕！
                </h3>
                <p className="text-xs text-slate-300 mt-2 max-w-md leading-relaxed px-4">
                  多媒体教学解说的模拟演示和智能音频配音已顺序演绎完成。
                </p>

                <div className="flex gap-3 mt-5 w-full max-w-xs px-4">
                  <button
                    onClick={() => {
                      setPlaybackComplete(false);
                      startSlideshow(false);
                    }}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    重新播放
                  </button>
                  <button
                    onClick={() => {
                      setPlaybackComplete(false);
                      setIsPlaying(false);
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all"
                  >
                    返回控制台
                  </button>
                </div>
              </motion.div>
            ) : downloadUrl && !isPlaying ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-950 flex flex-col items-center justify-center p-6 text-center z-40 select-none overflow-y-auto"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3 animate-bounce">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h3 className="text-lg md:text-xl font-black text-white px-4">
                  🎉 您的原创微课视频已成功录制！
                </h3>
                <p className="text-xs text-slate-300 mt-2 max-w-lg leading-relaxed">
                  系统已顺利将课件、音轨、BGM和数智人动画合成为超清 WebM 流媒体格式视频 (
                  <span className="text-emerald-400 font-extrabold font-mono text-sm">{(recordedSize / (1024 * 1024)).toFixed(2)} MB</span>)。
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mt-5 w-full max-w-md px-4">
                  <a
                    href={downloadUrl}
                    download="AI微课帮_我的高品质微课视频.webm"
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    立即下载高清视频 (WebM)
                  </a>
                  <button
                    onClick={() => {
                      setDownloadUrl(null);
                      startSlideshow(false);
                    }}
                    className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-700/50 flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-200" />
                    重新预览课件
                  </button>
                </div>

                <div className="mt-5 bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 max-w-md text-left text-[10px] text-slate-400 leading-relaxed font-semibold">
                  <span className="text-amber-400 font-bold text-[11px] block mb-1">💡 新手避坑指南 & 格式指南</span>
                  一键导出的WebM格式是现代浏览器录制标准。
                  <ul className="list-disc list-inside space-y-0.5 mt-1">
                    <li>如何播放：推荐使用暴风影音、QQ影音或 PotPlayer，在电脑直接双击即可完美播放。</li>
                    <li>
                      如何转为 MP4：在百度搜索「<span className="text-emerald-400">webm 转 mp4 在线</span>」，把下载所得文件拖入，1秒即可完成免费完美转换！
                    </li>
                  </ul>
                </div>
              </motion.div>
            ) : slides.length === 0 ? (
              <p className="text-slate-500 text-xs font-semibold">无课件幻灯片演示内容...</p>
            ) : (
              <div className="w-full h-full relative flex flex-col scale-90 select-none">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentSlideIdx}-${slides[currentSlideIdx]?.id}-${isImageMode}-${currentSlide?.backgroundImage}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`w-full h-full p-8 md:p-12 flex flex-col justify-between absolute inset-0 text-slate-100 rounded-xl ${
                      currentTheme.fontFamily
                    } ${
                      isImageMode && currentSlide.backgroundImage
                        ? "bg-cover bg-center text-white"
                        : currentTheme.background
                    }`}
                    style={
                      isImageMode && currentSlide.backgroundImage
                        ? { backgroundImage: `url(${currentSlide.backgroundImage})` }
                        : undefined
                    }
                  >
                    {/* Dark protective filter for clean text on custom slide backdrops */}
                    {isImageMode && currentSlide.backgroundImage && (
                      <div className="absolute inset-0 bg-slate-950/45 pointer-events-none z-0" />
                    )}

                    {/* Standard Theme Decors (Only shown in Standard CSS theme layout) */}
                    {!isImageMode && activeThemeId === "tech-blue" && (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.06),transparent)] pointer-events-none" />
                    )}
                    {!isImageMode && activeThemeId === "forest-green" && (
                      <div className="absolute top-4 right-6 text-emerald-800/10 font-serif text-[100px] pointer-events-none">🌿</div>
                    )}
                    {!isImageMode && activeThemeId === "chalkboard-dark" && (
                      <div className="absolute bottom-4 right-6 text-white/5 font-mono text-[70px] pointer-events-none">f(x)=√2</div>
                    )}

                    {/* Header elements based on showOverlayText */}
                    <div className={`space-y-1.5 pb-2 border-b border-white/5 z-10 transition-opacity duration-300 ${
                      isImageMode && !displayOverlay ? "opacity-0" : "opacity-100"
                    }`}>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md inline-block ${
                        isImageMode ? "bg-white/15 border border-white/20 text-white" : `${currentTheme.accentBg} ${currentTheme.accentText}`
                      }`}>
                        正在播放 • 第 {currentSlideIdx + 1} / {slides.length} 页微课课件
                      </span>
                      <h2 className={`text-xl md:text-2.5xl font-extrabold tracking-tight leading-normal mt-1 ${
                        isImageMode ? "text-white" : currentTheme.titleColor
                      }`}>
                        {currentSlide?.title || "未设置页标题"}
                      </h2>
                    </div>

                    {/* Content lists based on showOverlayText */}
                    <div className={`my-5 flex-1 flex flex-col justify-center z-10 transition-opacity duration-300 ${
                      isImageMode && !displayOverlay ? "opacity-0" : "opacity-100"
                    }`}>
                      <div className="grid grid-cols-1 gap-3 max-w-xl">
                        {currentSlide?.content.map((pt, j) => (
                          <div
                            key={j}
                            className={`flex items-start gap-3 p-3 rounded-lg border bg-black/10 transition-colors ${
                              isImageMode
                                ? "bg-white/10 border-white/10"
                                : currentTheme.cardStyle
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-md font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5 ${
                              isImageMode ? "bg-emerald-500 text-white" : `${currentTheme.accentBg} ${currentTheme.accentText}`
                            }`}>
                              {j + 1}
                            </span>
                            <p className="text-xs tracking-normal leading-relaxed">
                              {pt}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SPEAKING DIGITAL AVATAR EMBED (Renders bottom right inside slide for absolute capture) */}
                    {voiceSettings.avatarId && voiceSettings.avatarId !== "none" && (
                      <div className="absolute bottom-5 right-5 z-30 flex flex-col items-center">
                        <div className="relative">
                          {isPlaying && isAvatarSpeaking && (
                            <div className="absolute -top-7 -left-4 right-0 flex items-center justify-center pointer-events-none">
                              <span className="bg-emerald-500 text-slate-950 font-black text-[7px] px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-md uppercase tracking-wider scale-90">
                                <span className="w-1 h-1 rounded-full bg-slate-950 animate-ping" />
                                Speaking
                              </span>
                            </div>
                          )}
                          <div className={`w-18 h-18 rounded-full border-2 border-emerald-400 overflow-hidden bg-slate-800 shadow-xl transition-all duration-300 ${
                            isPlaying && isAvatarSpeaking ? "scale-[1.05] ring-4 ring-emerald-500/20" : ""
                          }`}>
                            <AvatarCanvas
                              avatarId={voiceSettings.avatarId}
                              isSpeaking={isPlaying && isAvatarSpeaking}
                              speed={voiceSettings.speed}
                            />
                          </div>
                        </div>
                        <span className="mt-1 font-extrabold text-[8px] bg-slate-950/80 text-emerald-400 border border-slate-700/60 px-1.5 py-0.5 rounded-full tracking-wide scale-90 backdrop-blur-xs">
                          {getAvatarName(voiceSettings.avatarId)}
                        </span>
                      </div>
                    )}

                    {/* Projection banner footer */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-3 text-[9px] opacity-40 z-10 text-slate-400">
                      <span>课件帮 • AI智课多媒体导出</span>
                      <span className="font-mono">{currentSlideIdx + 1} / {slides.length}</span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Subtitles Area */}
          <div className="mt-4 bg-slate-900 border border-slate-800 p-4.5 rounded-xl min-h-[90px] flex items-center justify-center text-center text-xs text-slate-200 tracking-wide font-medium">
            {renderSubtitles()}
          </div>
        </div>

        {/* Right Side: Professional Controller and Exporter Panel */}
        <div className="w-full md:w-80 bg-slate-900 flex flex-col p-6 space-y-5.5 select-none text-slate-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="font-extrabold text-[#fff] text-xs uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              微课视频导出中心
            </h4>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Instructions and Steps */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2.5">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-400 flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              如何录制并输出微课视频？
            </span>
            <ol className="text-[10px] text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed font-semibold">
              <li>点击下方的“同步伴音录像”按钮</li>
              <li>在弹出的对话框中选择 <span className="text-slate-100">【标签页 / Tab】</span>，并选择 <span className="text-emerald-400 font-bold">本项目页面</span></li>
              <li><span className="text-yellow-400 font-bold">【关键】</span>务必勾选底部的 <span className="text-emerald-400 font-bold">【共享标签页音频】</span>，否则录制出的视频会没有AI声音哦！</li>
              <li>点击共享。系统将全自动播放幻灯片并伴音解说。完成后自动停止并提供下载。</li>
            </ol>
          </div>

          {/* Recording actions block */}
          <div className="space-y-3 pt-2 flex-1">
            {!isPlaying ? (
              <>
                <button
                  onClick={() => startSlideshow(true)}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2"
                >
                  <Video className="w-5 h-5 shrink-0" />
                  1. 一键同步伴音录像
                </button>

                <button
                  onClick={() => startSlideshow(false)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-200" />
                  仅预览本地播放 (不录制)
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 border border-dashed border-rose-500/30 rounded-xl bg-rose-500/5 text-center space-y-1">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest animate-pulse inline-block">
                    ●正在同步录制或演示播放中
                  </span>
                  <p className="text-[10px] text-slate-400">
                    请不要移动鼠标或切换浏览器，让AI自动播放到底...
                  </p>
                  {isTabRecording && (
                    <div className="text-[10px] font-mono text-emerald-400 font-bold mt-1.5">
                      累计已捕获数据: {(recordedSize / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  )}
                </div>

                <button
                  onClick={stopEverything}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-955/20 animate-pulse"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  停止并保存当前视频流
                </button>
              </div>
            )}
          </div>

          {/* Download container once recorded block */}
          {downloadUrl && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-emerald-950/45 border border-emerald-500/30 rounded-xl space-y-3"
            >
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-slate-100">
                    微课视频生成录制成功！
                  </h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    录屏已合成为标准流格式，可在本地直接播放。
                  </p>
                </div>
              </div>

              <a
                href={downloadUrl}
                download="AI微课帮_我的原创微课视频.webm"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Download className="w-4 h-4" />
                下载高清 WebM/MP4
              </a>
            </motion.div>
          )}

          {/* Warn notice block */}
          <div className="text-[9px] font-medium text-slate-500 flex items-start gap-1 pb-1">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
            <span>
              注意：基于本地录制性能，建议在连接稳定、外界无干扰的声音环境中进行录制。
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
