"use client";

import { useEffect, useRef } from "react";

interface ShadeExplainerTooltipProps {
  visible: boolean;
  onClose: () => void;
}

const SCALE = [
  { range: "< 30%", label: "Exposed", desc: "No relief from the sun", color: "#F87171" },
  { range: "30–60%", label: "Partial shade", desc: "Some tree cover", color: "var(--amber-light)" },
  { range: "> 60%", label: "Well shaded", desc: "Dense canopy overhead", color: "var(--jade-light)" },
];

export default function ShadeExplainerTooltip({ visible, onClose }: ShadeExplainerTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="absolute z-50 rounded-xl overflow-hidden"
      style={{
        bottom: "calc(100% + 8px)",
        left: 0,
        width: "220px",
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "0 0 16px rgba(148,163,184,0.15), 0 8px 24px rgba(0,0,0,0.55)",
        animation: "slide-up 0.18s ease-out",
        pointerEvents: "auto",
      }}
    >
      <div className="px-3 pt-3 pb-2">
        <p className="font-grotesk font-bold text-xs mb-1" style={{ color: "var(--text-display)" }}>
          What is Shade Cover?
        </p>
        <p className="font-grotesk text-[11px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          % of tree canopy within 15 m of the route, mapped from satellite data.
        </p>
      </div>
      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }} />
      <div className="px-3 py-2 flex flex-col gap-1.5">
        {SCALE.map(({ range, label, desc, color }) => (
          <div key={range} className="flex items-center gap-2">
            <span className="font-mono-ui uppercase shrink-0" style={{ fontSize: "8px", letterSpacing: "0.12em", color, minWidth: "36px" }}>{range}</span>
            <div>
              <p className="font-grotesk font-semibold text-[10px] leading-none" style={{ color }}>{label}</p>
              <p className="font-grotesk text-[9px] leading-snug" style={{ color: "var(--text-disabled)" }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
