"use client";

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
}[] = [
  {
    key: "trees",
    label: "Tree Canopy",
    icon: "🌳",
    color: "linear-gradient(135deg, #10B981, #059669)",
    glow: "rgba(16, 185, 129, 0.50)",
    border: "rgba(52, 211, 153, 0.60)",
  },
  {
    key: "parks",
    label: "Parks",
    icon: "🏞",
    color: "linear-gradient(135deg, #34D399, #10B981)",
    glow: "rgba(52, 211, 153, 0.50)",
    border: "rgba(52, 211, 153, 0.60)",
  },
  {
    key: "lakes",
    label: "Waterbodies",
    icon: "💧",
    color: "linear-gradient(135deg, #06B6D4, #0284C7)",
    glow: "rgba(6, 182, 212, 0.50)",
    border: "rgba(103, 232, 249, 0.60)",
  },
  {
    key: "heat",
    label: "Heat Map",
    icon: "🌡",
    color: "linear-gradient(135deg, #F97316, #DC2626)",
    glow: "rgba(249, 115, 22, 0.50)",
    border: "rgba(251, 146, 60, 0.60)",
  },
  {
    key: "busStops",
    label: "Bus Stops",
    icon: "🚌",
    color: "linear-gradient(135deg, #A78BFA, #7C3AED)",
    glow: "rgba(124, 58, 237, 0.50)",
    border: "rgba(167, 139, 250, 0.60)",
  },
  {
    key: "trails",
    label: "Trails",
    icon: "🥾",
    color: "linear-gradient(135deg, #86EFAC, #22C55E)",
    glow: "rgba(134, 239, 172, 0.50)",
    border: "rgba(134, 239, 172, 0.60)",
  },
  {
    key: "events",
    label: "Events",
    icon: "🎉",
    color: "linear-gradient(135deg, #F472B6, #EC4899)",
    glow: "rgba(244, 114, 182, 0.50)",
    border: "rgba(249, 168, 212, 0.60)",
  },
];

export default function LayerControls({ visible, onChange }: LayerControlsProps) {
  return (
    <div className="flex flex-col gap-1.5 pointer-events-auto">
      {/* Section label — TERTIARY: Space Mono ALL CAPS, edge-anchored, de-emphasised */}
      <p
        className="font-mono-ui text-[10px] uppercase tracking-[0.18em] px-1 mb-0.5"
        style={{ color: "var(--text-disabled)" }}
      >
        ✦ Layers
      </p>

      {LAYERS.map(({ key, label, icon, color, glow, border }) => {
        const on = visible[key];
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={on}
            aria-label={`Toggle ${label} layer`}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200"
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
        );
      })}
    </div>
  );
}
