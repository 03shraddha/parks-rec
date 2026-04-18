"use client";

import type { TrailInfo } from "./Map";

interface TrailPopupProps {
  info: TrailInfo;
  onClose: () => void;
}

const SURFACE_LABELS: Record<string, { label: string; emoji: string }> = {
  paved:  { label: "Paved",  emoji: "🏃" },
  gravel: { label: "Gravel", emoji: "🚶" },
  dirt:   { label: "Dirt",   emoji: "🌿" },
};

const GREEN_GLOW = "rgba(134, 239, 172, 0.40)";
const GREEN_GRADIENT = "linear-gradient(135deg, #86EFAC, #22C55E)";

export default function TrailPopup({ info, onClose }: TrailPopupProps) {
  const surface = SURFACE_LABELS[info.surface] ?? { label: info.surface, emoji: "🥾" };
  const km = (info.length_m / 1000).toFixed(1);

  return (
    <div
      className="pointer-events-auto rounded-2xl overflow-hidden w-56"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(134, 239, 172, 0.20)",
        boxShadow: `0 0 14px ${GREEN_GLOW}, 0 10px 32px rgba(0,0,0,0.6)`,
        animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Green top accent */}
      <div className="h-0.5 w-full" style={{ background: GREEN_GRADIENT }} />

      {/* Header - surface badge + close */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span
          className="font-mono-ui uppercase tracking-[0.14em] px-2 py-0.5 rounded-full"
          style={{
            fontSize: "9px",
            background: "rgba(134, 239, 172, 0.15)",
            border: "1px solid rgba(134, 239, 172, 0.35)",
            color: "#86EFAC",
          }}
        >
          {surface.emoji} {surface.label}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-all duration-150"
          style={{
            background: "rgba(148,163,184,0.08)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#86EFAC";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(134,239,172,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(148,163,184,0.08)";
          }}
        >
          ✕
        </button>
      </div>

      {/* Trail name */}
      <div className="px-4 pb-3">
        <h3
          className="font-grotesk font-bold text-base leading-snug"
          style={{ color: "var(--text-display)", textShadow: `0 0 12px ${GREEN_GLOW}` }}
        >
          {info.name}
        </h3>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }} />

      {/* Distance */}
      <div className="px-4 py-3">
        <p className="font-grotesk font-bold text-2xl" style={{ color: "#86EFAC" }}>
          {km} <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>km</span>
        </p>
        <p
          className="font-mono-ui uppercase tracking-[0.10em] mt-1"
          style={{ fontSize: "9px", color: "var(--text-disabled)" }}
        >
          Walking trail · Bengaluru
        </p>
      </div>
    </div>
  );
}
