"use client";

import { useState } from "react";
import type { LayerVisibility } from "./Map";

interface LayerControlsProps {
  visible: LayerVisibility;
  onChange: (key: keyof LayerVisibility) => void;
}

/* Each layer has an anime-themed accent colour for its active glow */
const LAYERS: {
  key: keyof LayerVisibility;
  label: string;
  icon: string;
  color: string;       // active background
  glow: string;        // CSS shadow colour
  border: string;      // active border
  tooltip: string;
}[] = [
  {
    key: "trees",
    label: "Tree Canopy",
    icon: "🌳",
    color: "linear-gradient(135deg, #10B981, #059669)",
    glow: "rgba(16, 185, 129, 0.50)",
    border: "rgba(52, 211, 153, 0.60)",
    tooltip: "Shows satellite-mapped tree canopy across Bengaluru.",
  },
  {
    key: "parks",
    label: "Parks",
    icon: "🏞",
    color: "linear-gradient(135deg, #34D399, #10B981)",
    glow: "rgba(52, 211, 153, 0.50)",
    border: "rgba(52, 211, 153, 0.60)",
    tooltip: "Highlights public parks and green spaces.",
  },
  {
    key: "lakes",
    label: "Waterbodies",
    icon: "💧",
    color: "linear-gradient(135deg, #06B6D4, #0284C7)",
    glow: "rgba(6, 182, 212, 0.50)",
    border: "rgba(103, 232, 249, 0.60)",
    tooltip: "Lakes and ponds — cooler microclimates nearby.",
  },
  {
    key: "busStops",
    label: "Bus Stops",
    icon: "🚌",
    color: "linear-gradient(135deg, #A78BFA, #7C3AED)",
    glow: "rgba(124, 58, 237, 0.50)",
    border: "rgba(167, 139, 250, 0.60)",
    tooltip: "BMTC bus stop locations for multi-modal trips.",
  },
  {
    key: "trails",
    label: "Trails",
    icon: "🥾",
    color: "linear-gradient(135deg, #86EFAC, #22C55E)",
    glow: "rgba(134, 239, 172, 0.50)",
    border: "rgba(134, 239, 172, 0.60)",
    tooltip: "Pre-mapped walking trails with surface type and distance.",
  },
  {
    key: "events",
    label: "Events",
    icon: "🎉",
    color: "linear-gradient(135deg, #F472B6, #EC4899)",
    glow: "rgba(244, 114, 182, 0.50)",
    border: "rgba(249, 168, 212, 0.60)",
    tooltip: "Upcoming outdoor events in Bengaluru. Tap any pin.",
  },
];

export default function LayerControls({ visible, onChange }: LayerControlsProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="flex flex-col gap-1.5 pointer-events-auto">
        {/* Section label — TERTIARY: Space Mono ALL CAPS, edge-anchored, de-emphasised */}
        <p
          className="font-mono-ui text-[10px] uppercase tracking-[0.18em] px-1 mb-0.5"
          style={{ color: "var(--text-disabled)" }}
        >
          ✦ Layers
        </p>

        {LAYERS.map(({ key, label, icon, color, glow, border, tooltip }) => {
          const on = visible[key];
          return (
            <div key={key} className="relative">
              <button
                onClick={() => onChange(key)}
                aria-pressed={on}
                aria-label={`Toggle ${label} layer`}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200"
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(key)}
                onBlur={() => setHoveredKey(null)}
                style={
                  on
                    ? {
                        background: color,
                        border: `1px solid ${border}`,
                        color: "#fff",
                        boxShadow: `0 0 14px ${glow}, 0 4px 16px rgba(0,0,0,0.4)`,
                      }
                    : {
                        background: "var(--bg-card)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                      }
                }
              >
                {/* Icon badge */}
                <span
                  className="text-sm leading-none w-5 h-5 flex items-center justify-center rounded-md shrink-0"
                  style={
                    on
                      ? { background: "rgba(255,255,255,0.20)" }
                      : { background: "var(--border-subtle)" }
                  }
                >
                  {icon}
                </span>
                {/* SECONDARY: Space Grotesk body label */}
                <span className="font-grotesk">{label}</span>
              </button>

              {hoveredKey === key && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 6px)",
                    left: 0,
                    zIndex: 50,
                    pointerEvents: "none",
                    background: "var(--bg-card)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid var(--border-subtle)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    maxWidth: "200px",
                    whiteSpace: "normal",
                    animation: "fadeIn 0.15s ease-out",
                  }}
                >
                  <p className="font-grotesk" style={{ fontSize: "11px", color: "var(--text-primary)", lineHeight: "1.4" }}>
                    {tooltip}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
