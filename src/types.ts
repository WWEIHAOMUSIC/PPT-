export interface Slide {
  id: string;
  title: string;
  content: string[]; // List of points or paragraphs
  subtitle?: string;
  script: string; // Spoken narration text
  image?: string; // Optional image base64 or upload URL
  duration: number; // Approximate presentation duration in seconds (based on script speech rate)
  backgroundImage?: string; // Base64 or uploaded background image URL
  backgroundMode?: 'theme' | 'image'; // Theme CSS or Custom background image
  showOverlayText?: boolean; // Show bullet points/text overlay on top of background image
}

export type ThemeStyleId = 'tech-blue' | 'chalkboard-dark' | 'forest-green' | 'warm-sunshine' | 'crimson-editorial' | 'minimal-modern';

export interface ThemeStyle {
  id: ThemeStyleId;
  name: string;
  themeType: 'light' | 'dark';
  background: string; // Tailwind classes
  textColor: string; // Tailwind classes
  titleColor: string; // Tailwind classes
  accentBg: string; // Tailwind bg classes
  accentText: string; // Tailwind text classes
  fontFamily: string; // Tailwind font classes
  cardStyle: string; // Tailwind classes for presentation items
}

export type AvatarId = 'none' | 'emily' | 'leo' | 'doctor-cat' | 'gogo' | 'prof-davis';

export interface VoiceSettings {
  gender: 'female' | 'male' | 'child';
  voiceName: string; // Browser system voice name
  speed: number; // Rate 0.5 - 2.0
  pitch: number; // Pitch 0.5 - 2.0
  bgmId: string; // Procedural Background Music Option
  bgmVolume: number; // 0.0 - 1.0
  avatarId?: AvatarId; // Selected speaking avatar
  voiceEngine?: 'system' | 'cosyvoice2';
  cosyVoiceEmotion?: 'happy' | 'humor' | 'gentle' | 'passionate' | 'serious' | 'normal';
  clonedVoiceDataUrl?: string | null;
}

export interface BgmOption {
  id: string;
  name: string;
  emoji: string;
}

export interface CreationProject {
  id: string;
  title: string;
  slides: Slide[];
  themeId: ThemeStyleId;
  voiceSettings: VoiceSettings;
}
