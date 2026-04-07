"use client";

import { useState } from "react";
import type { SegmentInfo } from "@/lib/shadeScoring";
import ShadeExplainerTooltip from "./ShadeExplainerTooltip";

interface SegmentPopupProps {
  info: SegmentInfo;
  onClose: () => void;
}

function getSegmentKey(info: SegmentInfo): string {
  return `flagged_${(info.road_name ?? info.nearest_park ?? String(info.shade_score)).replace(/\s+/g, "_")}`;
}

export default function SegmentPopup({ info, onClose }: SegmentPopupProps) {
  const shade = Math.round(info.shade_score * 100);
  const [showExplainer, setShowExplainer] = useState(false);
  const segKey = getSegmentKey(info);
  const [flagged, setFlagged] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(segKey);
  });
  const handleFlag = () => {
    if (flagged) { localStorage.removeItem(segKey); setFlagged(false); }
    else { localStorage.setItem(segKey, "1"); setFlagged(true); }
  };

  /* Colour system: well-shaded = jade, partial = amber, exposed = crimson */
  const { color, glow, gradient, label } =
    shade >= 60
      ? {
          color: "var(--jade-light)",
          glow: "var(--jade-glow)",
          gradient: "linear-gradient(135deg, #10B981, #059669)",
          label: "Well shaded",
        }
      : shade >= 30
      ? {
          color: "var(--amber-light)",
          glow: "var(--amber-glow)",
          gradient: "linear-gradient(135deg, #F59E0B, #D97706)",
          label: "Partial shade",
        }
      : {
          color: "#F87171",
          glow: "rgba(248,113,113,0.45)",
          gradient: "linear-gradient(135deg, #EF4444, #DC2626)",
          label: "Exposed — no shade",
        };

  return (
    <div
      className="pointer-events-auto rounded-2xl overflow-hidden w-64"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid rgba(148,163,184,0.14)`,
        boxShadow: `0 0 16px ${glow}, 0 12px 40px rgba(0,0,0,0.65)`,
        animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Coloured top accent line */}
      <div className="h-0.5 w-full" style={{ background: gradient }} />

      {/* Header — SECONDARY: road name is supporting context */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span
          className="font-grotesk font-semibold text-sm truncate pr-2"
          style={{ color: "var(--text-primary)" }}
        >
          {info.road_name ?? "This segment"}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-all duration-150"
          style={{
            background: "rgba(148,163,184,0.08)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.20)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(148,163,184,0.08)";
          }}
        >
          ✕
        </button>
      </div>

      {/* Shade score — PRIMARY hero: ONE thing seen first, absurdly large */}
      <div className="px-4 pb-1" style={{ position: "relative" }}>
        {/* Shade score label row with explainer */}
        <div className="flex items-center gap-1.5 mb-1 relative">
          <p
            className="font-mono-ui uppercase tracking-[0.16em]"
            style={{ fontSize: "9px", color: "var(--text-disabled)" }}
          >
            Shade Score
          </p>
          <button
            onClick={() => setShowExplainer((v) => !v)}
            className="w-4 h-4 rounded-full flex items-center justify-center transition-all duration-150"
            style={{
              background: "rgba(148,163,184,0.10)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
              fontSize: "8px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
            aria-label="What is shade cover?"
          >
            ?
          </button>
          <ShadeExplainerTooltip visible={showExplainer} onClose={() => setShowExplainer(false)} />
        </div>

        {/* PRIMARY: display-size number — the visual anchor of this popup */}
        <div className="flex items-end gap-2 mb-2">
          <span
            className="font-grotesk font-bold leading-none"
            style={{ fontSize: "4rem", color, textShadow: `0 0 20px ${glow}` }}
          >
            {shade}
            <span className="font-grotesk font-semibold" style={{ fontSize: "1.5rem" }}>%</span>
          </span>
          {/* SECONDARY: shade quality label, tight to the number */}
          <span
            className="font-grotesk font-semibold text-xs pb-2"
            style={{ color }}
          >
            {label}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-2 rounded-full overflow-hidden mb-3"
          style={{ background: "rgba(148,163,184,0.10)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${shade}%`,
              background: gradient,
              boxShadow: `0 0 8px ${glow}`,
            }}
          />
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }} />

      {/* Detail rows */}
      <div className="flex flex-col gap-0 px-4 py-3">
        <InfoRow
          icon="🌳"
          label="Trees nearby"
          value={`${info.tree_count} trees within 15 m`}
        />

        {info.dominant_species && (
          <InfoRow
            icon="🍃"
            label="Common species"
            value={info.dominant_species}
          />
        )}

        {info.nearest_park && (
          <InfoRow
            icon="🏞"
            label="Nearest park"
            value={
              info.nearest_park_dist_m !== null
                ? `${info.nearest_park} (${info.nearest_park_dist_m} m)`
                : info.nearest_park
            }
          />
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }} />
      {/* Flag footer */}
      <div className="px-4 py-2 flex items-center justify-between">
        <button
          onClick={handleFlag}
          className="flex items-center gap-1.5 transition-all duration-150"
          style={{
            background: flagged ? "rgba(249,115,22,0.10)" : "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: "6px",
            color: flagged ? "#F97316" : "var(--text-disabled)",
            fontSize: "10px",
          }}
          aria-pressed={flagged}
          title={flagged ? "Remove flag" : "Flag inaccurate shade data"}
        >
          <span>{flagged ? "🚩" : "🏳"}</span>
          <span className="font-mono-ui uppercase tracking-[0.12em]" style={{ fontSize: "9px" }}>
            {flagged ? "Flagged" : "Flag this data"}
          </span>
        </button>
        {flagged && (
          <span className="font-mono-ui uppercase tracking-[0.10em]" style={{ fontSize: "8px", color: "var(--text-disabled)" }}>
            Tap again to remove
          </span>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex gap-2.5 py-2"
      style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}
    >
      {/* Icon badge */}
      <span
        className="text-sm w-6 h-6 flex items-center justify-center rounded-lg shrink-0 mt-0.5"
        style={{ background: "rgba(148,163,184,0.08)" }}
      >
        {icon}
      </span>

      <div>
        {/* TERTIARY: Space Mono ALL CAPS label */}
        <p
          className="font-mono-ui text-[9px] uppercase tracking-[0.14em] leading-tight mb-0.5"
          style={{ color: "var(--text-disabled)" }}
        >
          {label}
        </p>
        {/* SECONDARY: Space Grotesk body value */}
        <p
          className="font-grotesk text-xs leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
