import React, { useEffect, useRef } from "react";
import { AvatarId } from "../types";

interface AvatarCanvasProps {
  avatarId: AvatarId;
  isSpeaking: boolean;
  speed?: number; // Voice speed to alter rate of lipsync
  className?: string;
}

export default function AvatarCanvas({
  avatarId,
  isSpeaking,
  speed = 1.0,
  className = "",
}: AvatarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);

  // Keep track of animations
  const blinkTimerRef = useRef<number>(0);
  const isBlinkingRef = useRef<boolean>(false);
  const eyeStateRef = useRef<number>(1.0); // 1.0 is open, 0.0 is closed

  // Audio spectrum simulation
  const audioSpikeRef = useRef<number[]>(Array(8).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set pixel density ratio for razor-sharp rendering on Retina displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let startTime = Date.now();

    const render = () => {
      const time = Date.now() - startTime;
      const width = rect.width;
      const height = rect.height;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // Handle Blinking Lifecycle
      blinkTimerRef.current += 16.7; // Approx ms per frame
      if (!isBlinkingRef.current && blinkTimerRef.current > Math.random() * 3000 + 3000) {
        isBlinkingRef.current = true;
        blinkTimerRef.current = 0;
      }

      if (isBlinkingRef.current) {
        if (blinkTimerRef.current < 100) {
          // Closing
          eyeStateRef.current = Math.max(0, eyeStateRef.current - 0.25);
        } else if (blinkTimerRef.current < 200) {
          // Opening
          eyeStateRef.current = Math.min(1.0, eyeStateRef.current + 0.25);
        } else {
          // Finished
          isBlinkingRef.current = false;
          eyeStateRef.current = 1.0;
        }
      }

      // Handle Lipsync shape interpolation
      let mouthHeight = 0.15; // closed mouth base
      let mouthShapeFactor = 0; // 0=neutral, 1=open "A", 2=open "O"
      
      if (isSpeaking) {
        // Fast fluctuations based on timestamp to mimic speaking syllables
        const cycle = (time * 0.015 * speed) % (Math.PI * 2);
        // Vary heights of opening
        mouthHeight = 0.15 + Math.abs(Math.sin(cycle) * Math.cos(cycle * 0.4)) * 0.65;
        // Shift between wider and taller shapes
        mouthShapeFactor = Math.sin(time * 0.005) > 0 ? 1 : 2;
      }

      // Update Simulated Audio Spectrum Bars
      for (let i = 0; i < audioSpikeRef.current.length; i++) {
        if (isSpeaking) {
          const target = Math.random() * 15 + 3;
          audioSpikeRef.current[i] = audioSpikeRef.current[i] * 0.6 + target * 0.4;
        } else {
          audioSpikeRef.current[i] = audioSpikeRef.current[i] * 0.8;
        }
      }

      // Calculate Idle Head/Body sway & shift
      const idleSwayX = Math.sin(time * 0.0015) * 1.5;
      const idleSwayY = Math.cos(time * 0.002) * 1.0;
      const tiltAngle = Math.sin(time * 0.001) * 0.015;

      // Draw Avatar backgrounds & frames based on selection
      drawAvatar(
        ctx,
        avatarId,
        width,
        height,
        idleSwayX,
        idleSwayY,
        tiltAngle,
        eyeStateRef.current,
        mouthHeight,
        mouthShapeFactor,
        audioSpikeRef.current,
        isSpeaking,
        time
      );

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [avatarId, isSpeaking, speed]);

  // Main drawing routing
  const drawAvatar = (
    ctx: CanvasRenderingContext2D,
    id: AvatarId,
    w: number,
    h: number,
    swayX: number,
    swayY: number,
    tilt: number,
    blink: number,
    mouthH: number,
    shape: number,
    spectrum: number[],
    isSpeaking: boolean,
    time: number
  ) => {
    ctx.save();
    
    // Background card circle clip
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 2, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = isSpeaking ? "#10B981" : "#475569";
    ctx.stroke();
    ctx.clip();

    // Default Background colors
    const fillBg = (color1: string, color2: string) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };

    // Draw specific avatar skins and paths
    if (id === "emily") {
      fillBg("#ECFDF5", "#A7F3D0"); // Emerald Theme
      
      ctx.translate(w / 2, h / 2 + 10);
      ctx.rotate(tilt);
      ctx.translate(-w / 2, -h / 2 - 10);

      const cx = w / 2 + swayX * 0.5;
      const cy = h / 2 - 8 + swayY * 0.5;

      // Torso / Suit
      ctx.fillStyle = "#0D9488"; // Teal Jacket
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy + 50);
      ctx.bezierCurveTo(cx - 40, cy + 25, cx - 18, cy + 18, cx - 14, cy + 18);
      ctx.lineTo(cx + 14, cy + 18);
      ctx.bezierCurveTo(cx + 18, cy + 18, cx + 40, cy + 25, cx + 30, cy + 50);
      ctx.closePath();
      ctx.fill();

      // Shirt collar
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 18);
      ctx.lineTo(cx, cy + 28);
      ctx.lineTo(cx + 8, cy + 18);
      ctx.closePath();
      ctx.fill();

      // Hair Back
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.arc(cx, cy, 21, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - 21, cy - 5, 42, 20);

      // Face skin
      ctx.fillStyle = "#FEE2E2"; // Peach Pink Skin Tone
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 16, 0, Math.PI * 2);
      ctx.fill();

      // Hair Bangs
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(cx - 17, cy - 3);
      ctx.quadraticCurveTo(cx - 5, cy - 10, cx, cy - 4);
      ctx.quadraticCurveTo(cx + 5, cy - 10, cx + 17, cy - 3);
      ctx.quadraticCurveTo(cx + 14, cy - 13, cx, cy - 14);
      ctx.quadraticCurveTo(cx - 14, cy - 13, cx - 17, cy - 3);
      ctx.fill();

      // Eyes (handling blinking state)
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#1E293B";
      ctx.fillStyle = "#1E293B";

      const eyeY = cy - 2;
      const leftEyeX = cx - 6;
      const rightEyeX = cx + 6;

      if (blink < 0.2) {
        // Blind line
        ctx.beginPath();
        ctx.moveTo(leftEyeX - 3, eyeY);
        ctx.lineTo(leftEyeX + 3, eyeY);
        ctx.moveTo(rightEyeX - 3, eyeY);
        ctx.lineTo(rightEyeX + 3, eyeY);
        ctx.stroke();
      } else {
        // Glasses Framework + eyes
        ctx.strokeStyle = "#10B981"; // Emerald Glasses
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, 4.5, 0, Math.PI * 2);
        ctx.arc(rightEyeX, eyeY, 4.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(leftEyeX + 4.5, eyeY);
        ctx.lineTo(rightEyeX - 4.5, eyeY);
        ctx.stroke();

        // Eye Pupils
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, 1.5, 0, Math.PI * 2);
        ctx.arc(rightEyeX, eyeY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cheeks Blush
      ctx.fillStyle = "#F43F5E";
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(cx - 11, cy + 3, 2.5, 0, Math.PI * 2);
      ctx.arc(cx + 11, cy + 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Morphing Mouth
      ctx.fillStyle = "#BE123C";
      const mY = cy + 7;
      if (isSpeaking) {
        // Speaking mouth
        const heightVal = mouthH * 10;
        const widthVal = shape === 2 ? 6 : 9; // Ah vs Oh width
        ctx.beginPath();
        ctx.ellipse(cx, mY, widthVal / 2, heightVal / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Static Smile Arc
        ctx.strokeStyle = "#BE123C";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, mY - 1, 4, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }

    } else if (id === "leo") {
      fillBg("#ECFDF5", "#CFFAFE"); // Cyan Theme
      
      ctx.translate(w / 2, h / 2 + 10);
      ctx.rotate(tilt * 0.9);
      ctx.translate(-w / 2, -h / 2 - 10);

      const cx = w / 2 + swayX * 0.45;
      const cy = h / 2 - 9 + swayY * 0.6;

      // Torso / Suit
      ctx.fillStyle = "#1D4ED8"; // Blue blazer
      ctx.beginPath();
      ctx.moveTo(cx - 31, cy + 48);
      ctx.bezierCurveTo(cx - 41, cy + 24, cx - 18, cy + 18, cx - 14, cy + 18);
      ctx.lineTo(cx + 14, cy + 18);
      ctx.bezierCurveTo(cx + 18, cy + 18, cx + 41, cy + 24, cx + 31, cy + 48);
      ctx.closePath();
      ctx.fill();

      // Shirt & Red Tie
      ctx.fillStyle = "#FFFFFF"; // Shirt
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 18);
      ctx.lineTo(cx, cy + 26);
      ctx.lineTo(cx + 6, cy + 18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#EF4444"; // Red Tie
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy + 25);
      ctx.lineTo(cx + 2, cy + 25);
      ctx.lineTo(cx + 3, cy + 38);
      ctx.lineTo(cx, cy + 44);
      ctx.lineTo(cx - 3, cy + 38);
      ctx.closePath();
      ctx.fill();

      // Spike Hair Back
      ctx.fillStyle = "#1E293B"; 
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy);
      ctx.lineTo(cx - 16, cy - 20);
      ctx.lineTo(cx - 8, cy - 15);
      ctx.lineTo(cx - 4, cy - 24);
      ctx.lineTo(cx + 4, cy - 24);
      ctx.lineTo(cx + 8, cy - 15);
      ctx.lineTo(cx + 16, cy - 20);
      ctx.lineTo(cx + 18, cy);
      ctx.closePath();
      ctx.fill();

      // Face skin
      ctx.fillStyle = "#FFEDD5"; // Sand Skin Tone
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 15.5, 0, Math.PI * 2);
      ctx.fill();

      // Spiky front bangs
      ctx.fillStyle = "#1E293B";
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy - 5);
      ctx.lineTo(cx - 8, cy - 12);
      ctx.lineTo(cx - 2, cy - 7);
      ctx.lineTo(cx + 4, cy - 12);
      ctx.lineTo(cx + 10, cy - 6);
      ctx.lineTo(cx + 16, cy - 10);
      ctx.lineTo(cx + 12, cy - 1);
      ctx.lineTo(cx - 12, cy - 1);
      ctx.closePath();
      ctx.fill();

      // Eyes
      const eyeY = cy - 2;
      const leftEyeX = cx - 5.5;
      const rightEyeX = cx + 5.5;

      if (blink < 0.2) {
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(leftEyeX - 2.5, eyeY);
        ctx.lineTo(leftEyeX + 2.5, eyeY);
        ctx.moveTo(rightEyeX - 2.5, eyeY);
        ctx.lineTo(rightEyeX + 2.5, eyeY);
        ctx.stroke();
      } else {
        // Tech Cyan Screen glasses
        ctx.strokeStyle = "#06B6D4";
        ctx.lineWidth = 1.5;
        ctx.fillStyle = "#1E293B";
        ctx.beginPath();
        ctx.rect(leftEyeX - 4.5, eyeY - 4, 9, 7);
        ctx.rect(rightEyeX - 4.5, eyeY - 4, 9, 7);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(leftEyeX + 4.5, eyeY - 1);
        ctx.lineTo(rightEyeX - 4.5, eyeY - 1);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY - 0.5, 1.2, 0, Math.PI * 2);
        ctx.arc(rightEyeX, eyeY - 0.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Speaking mouth
      ctx.fillStyle = "#1E293B";
      const mY = cy + 7;
      if (isSpeaking) {
        const heightVal = mouthH * 9;
        const widthVal = shape === 1 ? 8 : 5;
        ctx.beginPath();
        ctx.ellipse(cx, mY, widthVal / 2, heightVal / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, mY - 0.5, 3.5, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }

    } else if (id === "doctor-cat") {
      fillBg("#FEF3C7", "#FDE68A"); // Cozy Amber
      
      ctx.translate(w / 2, h / 2 + 10);
      ctx.rotate(tilt * 1.2);
      ctx.translate(-w / 2, -h / 2 - 10);

      const cx = w / 2 + swayX * 0.6;
      const cy = h / 2 - 9 + swayY * 0.5;

      // Orange Cat Ears
      ctx.fillStyle = "#EA580C"; // Dark Orange
      ctx.beginPath();
      // Left Ear
      ctx.moveTo(cx - 17, cy - 2);
      ctx.lineTo(cx - 24, cy - 18);
      ctx.lineTo(cx - 8, cy - 10);
      // Right Ear
      ctx.moveTo(cx + 8, cy - 10);
      ctx.lineTo(cx + 24, cy - 18);
      ctx.lineTo(cx + 17, cy - 2);
      ctx.fill();

      // Inner pink ears
      ctx.fillStyle = "#FECDD3";
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 3);
      ctx.lineTo(cx - 20, cy - 14);
      ctx.lineTo(cx - 9, cy - 9);
      ctx.moveTo(cx + 9, cy - 9);
      ctx.lineTo(cx + 20, cy - 14);
      ctx.lineTo(cx + 15, cy - 3);
      ctx.fill();

      // Torso / Doctor Cloak
      ctx.fillStyle = "#475569"; // Slate uniform
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy + 42);
      ctx.quadraticCurveTo(cx - 32, cy + 24, cx - 14, cy + 18);
      ctx.lineTo(cx + 14, cy + 18);
      ctx.quadraticCurveTo(cx + 32, cy + 24, cx + 28, cy + 42);
      ctx.lineTo(cx, cy + 42);
      ctx.closePath();
      ctx.fill();

      // Outer coat layer
      ctx.fillStyle = "#F8FAFC"; // White physician lab coat
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy + 20);
      ctx.lineTo(cx - 10, cy + 20);
      ctx.lineTo(cx - 14, cy + 42);
      ctx.lineTo(cx - 26, cy + 42);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx + 22, cy + 20);
      ctx.lineTo(cx + 10, cy + 20);
      ctx.lineTo(cx + 14, cy + 42);
      ctx.lineTo(cx + 26, cy + 42);
      ctx.closePath();
      ctx.fill();

      // Cat Face
      ctx.fillStyle = "#F97316"; // Bright Orange Face
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 17, 0, Math.PI * 2);
      ctx.fill();

      // Lower snout patch
      ctx.fillStyle = "#FFF7ED";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Academic Hat
      ctx.fillStyle = "#1E293B"; // Scholar base
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 12);
      ctx.lineTo(cx, cy - 18);
      ctx.lineTo(cx + 14, cy - 12);
      ctx.lineTo(cx, cy - 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#0F172A";
      ctx.fillRect(cx - 5, cy - 14, 10, 4);

      // Yellow mortarboard tassel
      ctx.strokeStyle = "#FBBF24";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx + 12, cy - 8);
      ctx.lineTo(cx + 12, cy - 2);
      ctx.stroke();
      ctx.fillStyle = "#FBBF24";
      ctx.beginPath();
      ctx.arc(cx + 12, cy - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      const eyeY = cy + 1;
      const leftEyeX = cx - 6.5;
      const rightEyeX = cx + 6.5;

      if (blink < 0.2) {
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(leftEyeX - 2.5, eyeY);
        ctx.lineTo(leftEyeX + 2.5, eyeY);
        ctx.moveTo(rightEyeX - 2.5, eyeY);
        ctx.lineTo(rightEyeX + 2.5, eyeY);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#1E293B";
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, 3, 0, Math.PI * 2);
        ctx.arc(rightEyeX, eyeY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Eye specular highlights
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(leftEyeX - 1, eyeY - 1, 0.9, 0, Math.PI * 2);
        ctx.arc(rightEyeX - 1, eyeY - 1, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Small Red Nose
      ctx.fillStyle = "#F43F5E";
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy + 5);
      ctx.lineTo(cx + 2, cy + 5);
      ctx.lineTo(cx, cy + 6.5);
      ctx.closePath();
      ctx.fill();

      // Whiskers
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      // Left whiskers
      ctx.moveTo(cx - 10, cy + 6); ctx.lineTo(cx - 22, cy + 4);
      ctx.moveTo(cx - 10, cy + 8); ctx.lineTo(cx - 23, cy + 8);
      // Right whiskers
      ctx.moveTo(cx + 10, cy + 6); ctx.lineTo(cx + 22, cy + 4);
      ctx.moveTo(cx + 10, cy + 8); ctx.lineTo(cx + 23, cy + 8);
      ctx.stroke();

      // Mouth
      const mY = cy + 10;
      if (isSpeaking) {
        ctx.fillStyle = "#BE123C";
        const heightVal = mouthH * 8;
        ctx.beginPath();
        ctx.arc(cx, mY, heightVal / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Split cat mouth lines
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx - 2, mY - 2.5, 2.5, 0, Math.PI);
        ctx.arc(cx + 2, mY - 2.5, 2.5, 0, Math.PI);
        ctx.stroke();
      }

    } else if (id === "gogo") {
      fillBg("#0F172A", "#1E1B4B"); // Matrix Space Theme
      
      ctx.translate(w / 2, h / 2 + 10);
      ctx.rotate(tilt * 0.6);
      ctx.translate(-w / 2, -h / 2 - 10);

      const cx = w / 2 + swayX * 0.35;
      const cy = h / 2 - 8 + swayY * 0.45;

      // Robot antenna
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx, cy - 25);
      ctx.stroke();

      ctx.fillStyle = isSpeaking ? "#34D399" : "#059669";
      ctx.beginPath();
      ctx.arc(cx, cy - 26, 3.5, 0, Math.PI * 2);
      ctx.fill();
      
      if (isSpeaking) {
        ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 26, 6 + Math.sin(time*0.015)*3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Side ear muffs
      ctx.fillStyle = "#059669";
      ctx.fillRect(cx - 22, cy - 2, 4, 12);
      ctx.fillRect(cx + 18, cy - 2, 4, 12);

      // Torso / Neck base
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(cx - 6, cy + 14, 12, 10);

      // Torso shoulders
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(cx - 26, cy + 24);
      ctx.lineTo(cx + 26, cy + 24);
      ctx.lineTo(cx + 20, cy + 44);
      ctx.lineTo(cx - 20, cy + 44);
      ctx.closePath();
      ctx.fill();

      // Robot Head frame (Square rounded)
      ctx.fillStyle = "#34D399"; // Pastel Mint Green
      ctx.beginPath();
      ctx.roundRect?.(cx - 18, cy - 14, 36, 28, 8);
      ctx.fill();

      // Screen plate
      ctx.fillStyle = "#022C22";
      ctx.beginPath();
      ctx.roundRect?.(cx - 15, cy - 11, 30, 22, 5);
      ctx.fill();

      // Robot Eyes (Neon Cyan Matrices)
      const eyeY = cy - 4;
      const leftEyeX = cx - 6.5;
      const rightEyeX = cx + 6.5;

      ctx.fillStyle = isSpeaking ? "#67e8f9" : "#06b6d4";

      if (blink < 0.2) {
        ctx.fillRect(leftEyeX - 3, eyeY - 0.5, 6, 1.5);
        ctx.fillRect(rightEyeX - 3, eyeY - 0.5, 6, 1.5);
      } else {
        if (isSpeaking) {
          // Playful digital matrix eye shapes (arrow or taller blocks)
          ctx.beginPath();
          ctx.ellipse(leftEyeX, eyeY - 1, 2.2, 3.2, 0, 0, Math.PI * 2);
          ctx.ellipse(rightEyeX, eyeY - 1, 2.2, 3.2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(leftEyeX, eyeY - 1, 2.2, 0, Math.PI * 2);
          ctx.arc(rightEyeX, eyeY - 1, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Robot Mouth (Equalizer bars for voice feedback!)
      const mY = cy + 5;
      ctx.fillStyle = "#10B981";
      if (isSpeaking) {
        // Rhythmic wave pattern height
        const barW = 1.8;
        const gap = 1.2;
        const pts = [-5, -2.5, 0, 2.5, 5];
        pts.forEach((ptVal, idx) => {
          const oscMultiplier = Math.sin(time * 0.02 + idx) * 0.5 + 0.5;
          const barH = 2 + (mouthH * 10) * oscMultiplier;
          ctx.fillRect(cx + ptVal - barW/2, mY - barH/2, barW, barH);
        });
      } else {
        // Cool quiet straight pixel bar
        ctx.fillRect(cx - 6, mY - 0.8, 12, 1.6);
      }

    } else if (id === "prof-davis") {
      fillBg("#F1F5F9", "#CBD5E1"); // Tech Silver Slate
      
      ctx.translate(w / 2, h / 2 + 10);
      ctx.rotate(tilt * 0.8);
      ctx.translate(-w / 2, -h / 2 - 10);

      const cx = w / 2 + swayX * 0.4;
      const cy = h / 2 - 9 + swayY * 0.5;

      //torso / Gray Suit
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy + 46);
      ctx.bezierCurveTo(cx - 38, cy + 24, cx - 18, cy + 18, cx - 14, cy + 18);
      ctx.lineTo(cx + 14, cy + 18);
      ctx.bezierCurveTo(cx + 18, cy + 18, cx + 38, cy + 24, cx + 30, cy + 46);
      ctx.closePath();
      ctx.fill();

      // Shirt & Tie
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + 18);
      ctx.lineTo(cx, cy + 25);
      ctx.lineTo(cx + 6, cy + 18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#0284C7"; // Blue Tie
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy + 24);
      ctx.lineTo(cx + 2, cy + 24);
      ctx.lineTo(cx + 3, cy + 34);
      ctx.lineTo(cx, cy + 40);
      ctx.lineTo(cx - 3, cy + 34);
      ctx.closePath();
      ctx.fill();

      // Fluffy Elderly Gray Hair (Davis Signature)
      ctx.fillStyle = "#94A3B8";
      ctx.beginPath();
      ctx.arc(cx - 14, cy, 9, 0, Math.PI * 2);
      ctx.arc(cx + 14, cy, 9, 0, Math.PI * 2);
      ctx.arc(cx, cy - 14, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#94A3B8"; 
      ctx.beginPath();
      ctx.arc(cx - 16, cy - 8, 9, 0, Math.PI * 2);
      ctx.arc(cx + 16, cy - 8, 9, 0, Math.PI * 2);
      ctx.fill();

      // Elder skin
      ctx.fillStyle = "#FEE2E2";
      ctx.beginPath();
      ctx.arc(cx, cy + 3, 15, 0, Math.PI * 2);
      ctx.fill();

      // White Beard / Mustache
      ctx.fillStyle = "#E2E8F0";
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 10);
      ctx.quadraticCurveTo(cx - 12, cy + 26, cx, cy + 25);
      ctx.quadraticCurveTo(cx + 12, cy + 26, cx + 10, cy + 10);
      ctx.closePath();
      ctx.fill();

      // Eyes
      const eyeY = cy - 1;
      const leftEyeX = cx - 5.5;
      const rightEyeX = cx + 5.5;

      if (blink < 0.2) {
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(leftEyeX - 2.5, eyeY);
        ctx.lineTo(leftEyeX + 2.5, eyeY);
        ctx.moveTo(rightEyeX - 2.5, eyeY);
        ctx.lineTo(rightEyeX + 2.5, eyeY);
        ctx.stroke();
      } else {
        // Glasses
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, 4.5, 0, Math.PI * 2);
        ctx.arc(rightEyeX, eyeY, 4.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(leftEyeX + 4.5, eyeY);
        ctx.lineTo(rightEyeX - 4.5, eyeY);
        ctx.stroke();

        ctx.fillStyle = "#0F172A";
        ctx.beginPath();
        ctx.arc(leftEyeX, eyeY, 1.2, 0, Math.PI * 2);
        ctx.arc(rightEyeX, eyeY, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mouth
      const mY = cy + 7;
      if (isSpeaking) {
        ctx.fillStyle = "#7F1D1D";
        const heightVal = mouthH * 8;
        const widthVal = shape === 2 ? 5 : 7;
        ctx.beginPath();
        ctx.ellipse(cx, mY, widthVal / 2, heightVal / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "#7F1D1D";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, mY, 3, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }
    }

    // DRAW THE ALIBABA COSYVOICE 2 FREQUENCY SPECTRUM WAVEFORM (Visually integrated at the bottom of the card)
    if (isSpeaking) {
      const barCount = spectrum.length;
      const totalWidth = barCount * 4 + (barCount - 1) * 2;
      const startX = (w - totalWidth) / 2;
      const baselineY = h - 14;

      ctx.fillStyle = "rgba(16, 185, 129, 0.85)"; // Glowing Emerald Green
      spectrum.forEach((val, index) => {
        const xCoord = startX + index * 6;
        const barHeight = val;
        // Paint rounded spectral columns
        ctx.beginPath();
        ctx.roundRect?.(xCoord, baselineY - barHeight, 3.5, barHeight, 1.5);
        ctx.fill();
      });

      // Small high-tech watermark overlay text
      ctx.fillStyle = "#34D399";
      ctx.font = "bold 7px JetBrains Mono, ui-monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("COSYVOICE 2 HIGH-FIDELITY SYNTH", w / 2, h - 4);
    } else {
      // Small high-tech watermark overlay text in idle matching system
      ctx.fillStyle = "#94A3B8";
      ctx.font = "bold 6.5px JetBrains Mono, ui-monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CosyVoice 2 • IDLE", w / 2, h - 5);
    }

    ctx.restore();
  };
}
