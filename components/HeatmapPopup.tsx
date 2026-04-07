"use client";

import type { HeatmapInfo } from "./Map";

interface HeatmapPopupProps {
  info: HeatmapInfo;
  onClose: () => void;
}

function getTier(count: number): { label: string; color: string; desc: string; emoji: string } {
  if (count <= 50)  return { label: "Scorching", color: "#FF4500", desc: "Very little tree cover in this area. Expect strong direct sun exposure.", emoji: "🔥" };
  if (count <= 150) return { label: "Hot",       color: "#FF8C00", desc: "Some trees present but shade is sparse. Pack sunscreen.", emoji: "☀️" };
  if (count <= 299) return { label: "Warm",      color: "#FFD700", desc: "Moderate tree canopy provides partial shade.", emoji: "🌤" };
  return              { label: "Cool",      color: "#90EE90", desc: "Dense tree canopy — this area offers solid shade for walking.", emoji: "🌳" };
}

export default function HeatmapPopup({ info, onClose }: HeatmapPopupProps) {
  const tier = getTier(info.tree_count);

  return (
    <div
      className="pointer-events-auto rounded-2xl overflow-hidden w-56"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${tier.color}33`,
        boxShadow: `0 0 14px ${tier.color}55, 0 10px 32px rgba(0,0,0,0.6)`,
        animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Color top accent */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${tier.color}, ${tier.color}88)` }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span
          className="font-mono-ui uppercase tracking-[0.14em] px-2 py-0.5 rounded-full"
          style={{
            fontSize: "9px",
            background: `${tier.color}22`,
            border: `1px solid ${tier.color}55`,
            color: tier.color,
          }}
        >
          {tier.emoji} {tier.label}
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
            (e.currentTarget as HTMLButtonElement).style.color = tier.color;
            (e.currentTarget as HTMLButtonElement).style.background = `${tier.color}22`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(148,163,184,0.08)";
          }}
        >
          ✕
        </button>
      </div>

      {/* Tree count */}
      <div className="px-4 pb-3">
        <p className="font-grotesk font-bold text-2xl" style={{ color: tier.color }}>
          {info.tree_count}
          <span className="font-grotesk text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>
            trees mapped
          </span>
        </p>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }} />

      {/* Description */}
      <div className="px-4 py-3">
        <p className="font-grotesk text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {tier.desc}
        </p>
      </div>
    </div>
  );
}
