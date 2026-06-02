/**
 * Procedural Audio Generator using Web Audio API
 * Generates beautiful, royalty-free, and size-free classroom ambient background loops on the fly.
 */

let audioCtx: AudioContext | null = null;
let bgmOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];
let bgmGain: GainNode | null = null;
let bgmInterval: any = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Chords definitions for our styles
const CHORDS: Record<string, number[][]> = {
  // Lofi Chill: Cmaj7 - Am7 - Fmaj7 - G6
  lofi: [
    [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3
    [110.00, 130.81, 164.81, 196.00], // A2, C3, E3, G3
    [87.31, 130.81, 174.61, 218.27],  // F2, C3, F3, A3
    [98.00, 146.83, 196.00, 246.94],  // G2, D3, G3, B3
  ],
  // Inspiring Piano: C - G - Am - F (with high notes arpeggios)
  piano: [
    [130.81, 196.00, 261.63, 329.63], // C3, G3, C4, E4
    [98.00, 146.83, 293.66, 392.00],  // G2, D3, D4, G4
    [110.00, 164.81, 220.00, 329.63], // A2, E3, A3, E4
    [87.31, 131.81, 174.61, 349.23],  // F2, C3, F3, F4
  ],
  // Academic Ambient: Ticking soft sine wave background, minor chord suspension
  academic: [
    [146.83, 220.00, 293.66, 440.00], // D3, A3, D4, A4
    [116.54, 174.61, 233.08, 349.23], // Bb2, F3, Bb3, F4
    [110.00, 164.81, 220.00, 329.63], // A2, E3, A3, E4
    [130.81, 196.00, 261.63, 392.00], // C3, G3, C4, G4
  ]
};

export function startProceduralBGM(bgmId: string, volume: number = 0.3) {
  stopProceduralBGM();
  if (bgmId === "none") return;

  try {
    const ctx = getAudioContext();
    bgmGain = ctx.createGain();
    bgmGain.gain.setValueAtTime(volume * 0.15, ctx.currentTime); // Low baseline volume
    bgmGain.connect(ctx.destination);

    let chordIdx = 0;
    const chords = CHORDS[bgmId] || CHORDS.lofi;
    const isLofi = bgmId === "lofi";
    const isPiano = bgmId === "piano";
    const isAcademic = bgmId === "academic";

    const playStep = () => {
      const chord = chords[chordIdx];
      const now = ctx.currentTime;

      // Play pad/chords
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        
        // Soft synth characters
        if (isLofi) {
          osc.type = "triangle"; // Warm triangle waves
        } else if (isPiano) {
          osc.type = "sine";
        } else {
          osc.type = "sine"; // Clean sine waves
        }

        osc.frequency.setValueAtTime(freq, now);
        
        // Slow attack, long release
        oscGain.gain.setValueAtTime(0, now);
        oscGain.gain.linearRampToValueAtTime(0.08, now + 1.2);
        oscGain.gain.setValueAtTime(0.08, now + 3.5);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.8);

        osc.connect(oscGain);
        oscGain.connect(bgmGain!);
        osc.start(now);
        osc.stop(now + 6.0);

        bgmOscillators.push({ osc, gain: oscGain });
      });

      // Add a soft procedural rhythm element
      if (isLofi) {
        // Soft ambient vinyl static/hiss
        const noiseNode = ctx.createBufferSource();
        const noiseSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        noiseNode.buffer = noiseBuffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.003, now);
        noiseNode.connect(noiseGain);
        noiseGain.connect(bgmGain!);
        noiseNode.start(now);
      }

      // Add arpeggiator / melodic overlay
      if (isPiano || isLofi) {
        // Play 4 notes arpeggiated during the 6s chord lifecycle
        const melodyPitches = [
          chord[2] * 2, // High octaves
          chord[3] * 2,
          chord[1] * 2,
          chord[3] * 2.5
        ];

        melodyPitches.forEach((freq, stepIdx) => {
          const mTime = now + 0.5 + stepIdx * 1.2;
          const mOsc = ctx.createOscillator();
          const mGain = ctx.createGain();

          mOsc.type = "sine";
          mOsc.frequency.setValueAtTime(freq, mTime);

          // Fast attack, beautiful delay-like decay
          mGain.gain.setValueAtTime(0, mTime);
          mGain.gain.linearRampToValueAtTime(isPiano ? 0.04 : 0.02, mTime + 0.05);
          mGain.gain.exponentialRampToValueAtTime(0.0001, mTime + 1.0);

          mOsc.connect(mGain);
          mGain.connect(bgmGain!);
          mOsc.start(mTime);
          mOsc.stop(mTime + 1.1);

          bgmOscillators.push({ osc: mOsc, gain: mGain });
        });
      }

      if (isAcademic) {
        // Add a gentle steady ticking clock pulse to represent structured focus
        for (let second = 0; second < 6; second++) {
          const clickTime = now + second * 1.0;
          const oscClick = ctx.createOscillator();
          const gainClick = ctx.createGain();

          oscClick.type = "sine";
          oscClick.frequency.setValueAtTime(1200, clickTime);

          gainClick.gain.setValueAtTime(0.015, clickTime);
          gainClick.gain.exponentialRampToValueAtTime(0.0001, clickTime + 0.05);

          oscClick.connect(gainClick);
          gainClick.connect(bgmGain!);
          oscClick.start(clickTime);
          oscClick.stop(clickTime + 0.06);

          bgmOscillators.push({ osc: oscClick, gain: gainClick });
        }
      }

      chordIdx = (chordIdx + 1) % chords.length;
    };

    // Trigger first step
    playStep();
    // Loop every 6 seconds
    bgmInterval = setInterval(playStep, 6000);

  } catch (err) {
    console.warn("Failed to initialize background music generator:", err);
  }
}

export function stopProceduralBGM() {
  if (bgmInterval) {
    clearInterval(bgmInterval);
    bgmInterval = null;
  }

  bgmOscillators.forEach((item) => {
    try {
      item.osc.stop();
    } catch {}
    try {
      item.gain.disconnect();
    } catch {}
  });
  bgmOscillators = [];

  if (bgmGain) {
    try {
      bgmGain.disconnect();
    } catch {}
    bgmGain = null;
  }
}

export function setBGMVolume(volume: number) {
  if (bgmGain) {
    const ctx = getAudioContext();
    bgmGain.gain.linearRampToValueAtTime(volume * 0.15, ctx.currentTime + 0.1);
  }
}

/**
 * Text-to-Speech Helper (Windows Speak Synthesis)
 */
export function speakText(
  text: string, 
  settings: { 
    voiceName?: string; 
    speed?: number; 
    pitch?: number;
    voiceEngine?: 'system' | 'cosyvoice2';
    cosyVoiceEmotion?: 'happy' | 'humor' | 'gentle' | 'passionate' | 'serious' | 'normal';
  }, 
  onBoundary: (charIndex: number, charLength: number) => void,
  onEnd: () => void,
  onError: () => void
): SpeechSynthesisUtterance | null {
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis is not supported in this browser.");
    onError();
    return null;
  }

  window.speechSynthesis.cancel(); // Stop any pending speech

  // Detect and strip emotion tags if any, such as [喜悦], [激昂], to avoid them being read literally
  let cleanText = text;
  let emotionPitchModifier = 1.0;
  let emotionSpeedModifier = 1.0;

  // Process CosyVoice 2 Emotion brackets in the script text
  if (settings.voiceEngine === 'cosyvoice2' || /\[.*\]/.test(text)) {
    const emotionMatch = text.match(/\[(.*?)\]/);
    const emotionTag = emotionMatch ? emotionMatch[1] : "";
    
    // Strip all bracket tags from the text to read
    cleanText = text.replace(/\[[^\]]+\]/g, "");

    // Apply pitch and speed rules based on extracted emotionTag or active settings
    const activeEmotion = emotionTag || settings.cosyVoiceEmotion || 'normal';

    if (activeEmotion.includes("喜悦") || activeEmotion.includes("高兴") || activeEmotion === "happy") {
      emotionPitchModifier = 1.14;
      emotionSpeedModifier = 1.08;
    } else if (activeEmotion.includes("激昂") || activeEmotion.includes("激情") || activeEmotion.includes("澎湃") || activeEmotion === "passionate") {
      emotionPitchModifier = 1.25;
      emotionSpeedModifier = 1.18;
    } else if (activeEmotion.includes("严肃") || activeEmotion.includes("沉稳") || activeEmotion.includes("科普") || activeEmotion === "serious") {
      emotionPitchModifier = 0.88;
      emotionSpeedModifier = 0.92;
    } else if (activeEmotion.includes("温馨") || activeEmotion.includes("治愈") || activeEmotion.includes("温柔") || activeEmotion === "gentle") {
      emotionPitchModifier = 1.02;
      emotionSpeedModifier = 0.86;
    } else if (activeEmotion.includes("幽默") || activeEmotion.includes("思考") || activeEmotion === "humor") {
      emotionPitchModifier = 1.08;
      emotionSpeedModifier = 1.02;
    }
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  
  // Set voice if specified
  if (settings.voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find((v) => v.name === settings.voiceName);
    if (targetVoice) {
      utterance.voice = targetVoice;
    }
  }

  // Multiply basic rates by emotion factors
  utterance.rate = (settings.speed || 1.0) * emotionSpeedModifier;
  utterance.pitch = (settings.pitch || 1.0) * emotionPitchModifier;
  utterance.lang = "zh-CN";

  // Bind callback events
  utterance.onboundary = (event) => {
    if (event.name === "word") {
      // In speech synthesis, boundary charLength can be calculated
      onBoundary(event.charIndex, event.charLength || 1);
    }
  };

  utterance.onend = () => {
    onEnd();
  };

  utterance.onerror = (event) => {
    console.error("Speech synthesis error:", event);
    onError();
  };

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
