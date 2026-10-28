// Talk2Tasks AI — Adorable Pet Fidget Mascot ("Kiko")
// Clean, elegant, minimalist design with zero tacky AI neon gradients.
// Features expressive kawaii eyes, soft pastel details, cute paws, and dynamic states.

import React from 'react';
import type { MascotState } from './FloatingWidget';

interface CuteMascotProps {
  state?: MascotState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showMoodBubble?: boolean;
  bubbleText?: string;
  className?: string;
  onClick?: () => void;
}

export default function CuteMascot({
  state = 'idle',
  size = 'md',
  showMoodBubble = false,
  bubbleText,
  className = '',
  onClick,
}: CuteMascotProps) {
  // Dimensions based on size
  const sizeMap = {
    sm: { width: 44, height: 44 },
    md: { width: 64, height: 64 },
    lg: { width: 84, height: 84 },
    xl: { width: 110, height: 110 },
  };

  const { width, height } = sizeMap[size] || sizeMap.md;

  // Simple, elegant solid semantic colors (no neon gradients)
  const stateThemes: Record<MascotState, { accent: string; badge: string; moodText: string }> = {
    idle: {
      accent: '#3b82f6', // Clean classic blue
      badge: '#60a5fa',
      moodText: 'Ready & listening',
    },
    searching: {
      accent: '#0284c7', // Sky blue
      badge: '#38bdf8',
      moodText: 'Detecting meeting...',
    },
    waiting_confirmation: {
      accent: '#d97706', // Warm amber
      badge: '#fbbf24',
      moodText: 'Ready to record',
    },
    connecting: {
      accent: '#2563eb', // Solid blue
      badge: '#3b82f6',
      moodText: 'Connecting audio...',
    },
    listening: {
      accent: '#10b981', // Clean emerald
      badge: '#34d399',
      moodText: 'Transcribing live...',
    },
    processing: {
      accent: '#2563eb', // Clean blue
      badge: '#60a5fa',
      moodText: 'Processing...',
    },
    important_update: {
      accent: '#f59e0b', // Warm gold
      badge: '#fbbf24',
      moodText: 'New task captured!',
    },
    paused: {
      accent: '#64748b', // Slate
      badge: '#94a3b8',
      moodText: 'Paused (sleeping)',
    },
    error: {
      accent: '#e11d48', // Clean rose
      badge: '#f43f5e',
      moodText: 'Needs attention',
    },
    ended: {
      accent: '#10b981', // Emerald
      badge: '#34d399',
      moodText: 'Meeting saved!',
    },
  };

  const theme = stateThemes[state] || stateThemes.idle;

  // Gentle, charming animation
  const getBodyAnimation = () => {
    switch (state) {
      case 'listening':
        return 'animate-bounce duration-1000';
      case 'processing':
        return 'animate-pulse';
      case 'important_update':
        return 'animate-bounce';
      case 'paused':
        return 'opacity-90';
      default:
        return 'hover:scale-105 transition-transform duration-200';
    }
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`relative inline-flex items-center justify-center select-none cursor-pointer outline-none group ${className}`}
      style={{ width, height, WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
      title="Click mascot for quick actions"
    >
      {/* ── SPEECH/STATUS BUBBLE ─────────────────────────────────────────── */}
      {showMoodBubble && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-md border backdrop-blur-md transition-all duration-200 z-30 pointer-events-none"
          style={{
            background: 'rgba(255, 255, 255, 0.96)',
            borderColor: '#bfdbfe',
            color: '#1d4ed8',
            boxShadow: '0 2px 10px rgba(37, 99, 235, 0.15)',
          }}
        >
          {bubbleText || theme.moodText}
        </div>
      )}

      {/* ── SVG CUTE PET MASCOT ────────────────────────────────────────────── */}
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full relative z-10 transition-transform duration-200 drop-shadow-md ${getBodyAnimation()}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      >
        {/* Full Click/Touch Hit Target - Guaranteed hit-testing in Blink/Electron */}
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="#000000"
          fillOpacity={0.001}
          style={{ pointerEvents: 'all', cursor: 'pointer' }}
        />
        {/* ── EARS ────────────────────────────────────────────────────────── */}
        {/* Left Ear */}
        <g className="transition-transform duration-200 origin-[26px_34px]">
          {/* Outer Ear Shell (Clean Warm Porcelain) */}
          <path
            d="M 22 42 C 15 28 20 12 34 18 C 36 26 34 36 29 42 Z"
            fill="#ffffff"
            stroke="#334155"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Inner Ear Pad (Soft Pastel Pink) */}
          <path
            d="M 24 36 C 20 28 22 17 31 22 C 32 27 31 33 28 36 Z"
            fill="#fbcfe8"
          />
        </g>

        {/* Right Ear */}
        <g className="transition-transform duration-200 origin-[74px_34px]">
          {/* Outer Ear Shell */}
          <path
            d="M 78 42 C 85 28 80 12 66 18 C 64 26 66 36 71 42 Z"
            fill="#ffffff"
            stroke="#334155"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Inner Ear Pad (Soft Pastel Pink) */}
          <path
            d="M 76 36 C 80 28 78 17 69 22 C 68 27 69 33 72 36 Z"
            fill="#fbcfe8"
          />
        </g>

        {/* ── CHUBBY PET BODY (Porcelain White with crisp dark slate stroke) ─ */}
        <rect
          x="18"
          y="24"
          width="64"
          height="56"
          rx="26"
          fill="#ffffff"
          stroke="#334155"
          strokeWidth="3"
        />

        {/* Belly Patch (Soft warm cream) */}
        <ellipse cx="50" cy="56" rx="24" ry="20" fill="#f8fafc" />

        {/* ── ROSY CHEEKS (Soft Pastel Blush) ────────────────────────────── */}
        {state !== 'paused' && state !== 'error' && (
          <>
            <circle cx="28" cy="54" r="4.5" fill="#fda4af" opacity="0.8" />
            <circle cx="72" cy="54" r="4.5" fill="#fda4af" opacity="0.8" />
          </>
        )}

        {/* ── EXPRESSIVE KAWAII EYES & MOUTH ──────────────────────────────── */}
        {/* STATE: LISTENING (Happy attentive eyes with sound waves) */}
        {state === 'listening' && (
          <g>
            {/* Left Big Shiny Eye */}
            <g>
              <ellipse cx="36" cy="44" rx="6" ry="7" fill="#1e293b" />
              <circle cx="34" cy="41" r="2.4" fill="#ffffff" />
              <circle cx="38" cy="46" r="1.2" fill="#ffffff" />
            </g>

            {/* Right Big Shiny Eye */}
            <g>
              <ellipse cx="64" cy="44" rx="6" ry="7" fill="#1e293b" />
              <circle cx="62" cy="41" r="2.4" fill="#ffffff" />
              <circle cx="66" cy="46" r="1.2" fill="#ffffff" />
            </g>

            {/* Cute Kitten Smile */}
            <path
              d="M 44 52 Q 47 55 50 52 Q 53 55 56 52"
              stroke="#334155"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* STATE: IMPORTANT UPDATE (Star Eyes ★ ‿ ★) */}
        {state === 'important_update' && (
          <g>
            {/* Left Star Eye */}
            <path
              d="M 36 38 L 37.5 43 L 42 44 L 38.5 47 L 39.5 52 L 36 49 L 32.5 52 L 33.5 47 L 30 44 L 34.5 43 Z"
              fill="#f59e0b"
            />

            {/* Right Star Eye */}
            <path
              d="M 64 38 L 65.5 43 L 70 44 L 66.5 47 L 67.5 52 L 64 49 L 60.5 52 L 61.5 47 L 58 44 L 62.5 43 Z"
              fill="#f59e0b"
            />

            {/* Happy Open Smile */}
            <path
              d="M 45 52 Q 50 58 55 52"
              stroke="#334155"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="#fbcfe8"
            />
          </g>
        )}

        {/* STATE: PAUSED (Sweet Sleeping ˘ ᵕ ˘ with floating zZz) */}
        {state === 'paused' && (
          <g>
            {/* Left Sleeping Curved Eye */}
            <path
              d="M 31 46 Q 36 51 41 46"
              stroke="#64748b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Right Sleeping Curved Eye */}
            <path
              d="M 59 46 Q 64 51 69 46"
              stroke="#64748b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Peaceful Smile */}
            <path
              d="M 46 52 Q 50 55 54 52"
              stroke="#64748b"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Cute Sleep Letters */}
            <text x="68" y="32" fill="#94a3b8" fontSize="8" fontWeight="bold">z</text>
            <text x="75" y="24" fill="#64748b" fontSize="10" fontWeight="bold">Z</text>
          </g>
        )}

        {/* STATE: ERROR (Worried Squinched >.<) */}
        {state === 'error' && (
          <g>
            <path d="M 32 40 L 40 45 L 32 50" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 68 40 L 60 45 L 68 50" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 44 54 Q 47 51 50 54 Q 53 57 56 54" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {/* STATE: IDLE / PROCESSING / DEFAULT (Sweet attentive kawaii eyes) */}
        {state !== 'listening' && state !== 'important_update' && state !== 'paused' && state !== 'error' && (
          <g>
            {/* Left Big Shiny Eye */}
            <g>
              <ellipse cx="36" cy="44" rx="5.5" ry="6.5" fill="#1e293b" />
              <circle cx="34" cy="41" r="2.2" fill="#ffffff" />
              <circle cx="38" cy="46" r="1.1" fill="#ffffff" />
            </g>

            {/* Right Big Shiny Eye */}
            <g>
              <ellipse cx="64" cy="44" rx="5.5" ry="6.5" fill="#1e293b" />
              <circle cx="62" cy="41" r="2.2" fill="#ffffff" />
              <circle cx="66" cy="46" r="1.1" fill="#ffffff" />
            </g>

            {/* Sweet Kitten Smile */}
            <path
              d="M 44 52 Q 47 55 50 52 Q 53 55 56 52"
              stroke="#334155"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* ── CUTE COLLAR WITH STATUS JEWEL (Simple Solid Color) ─────────── */}
        {/* Collar band */}
        <path
          d="M 32 72 Q 50 78 68 72"
          stroke="#475569"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Collar Bell / Status Jewel */}
        <circle
          cx="50"
          cy="75"
          r="4.5"
          fill={theme.accent}
          stroke="#ffffff"
          strokeWidth="1.5"
        />

        {/* ── PAWS RESTING AT FRONT ────────────────────────────────────────── */}
        <ellipse
          cx="33"
          cy="77"
          rx="6"
          ry="4"
          fill="#ffffff"
          stroke="#334155"
          strokeWidth="2"
        />
        <ellipse
          cx="67"
          cy="77"
          rx="6"
          ry="4"
          fill="#ffffff"
          stroke="#334155"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

