"use client";

import { useEffect, useState } from "react";

interface HeatAdvisoryProps {
  onDismiss: () => void;
}

export default function HeatAdvisory({ onDismiss }: HeatAdvisoryProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show once per browser session
    if (sessionStorage.getItem("heat_advisory_dismissed")) return;
    const hour = new Date().getHours();
    const isPeakHeat = hour >= 11 && hour < 15;
    const isEvening = hour >= 18 || hour < 6;
    if (isPeakHeat || isEvening) setVisible(true);
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem("heat_advisory_dismissed", "1");
    setVisible(false);
    onDismiss();
  };

  if (!visible) return null;

  const hour = new Date().getHours();
  const isPeakHeat = hour >= 11 && hour < 15;

  if (isPeakHeat) {
    return (
      <div
        className="pointer-events-auto rounded-2xl p-4"
        style={{
          background: "rgba(251,146,60,0.12)",
          backdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(251,146,60,0.30)",
          boxShadow: "0 0 16px rgba(251,146,60,0.20), 0 8px 24px rgba(0,0,0,0.5)",
          animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌡</span>
            <p className="font-grotesk font-bold text-sm" style={{ color: "#FCD34D" }}>
              Peak heat hours
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 w-5 h-5 rounded-lg flex items-center justify-center text-xs transition-all duration-150"
            style={{ background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.30)", color: "#FCD34D" }}
          >
            ✕
          </button>
        </div>
        <p className="font-grotesk text-xs leading-relaxed mb-1.5" style={{ color: "#FDE68A" }}>
          It&apos;s midday in Bengaluru — exposed stretches can reach 42°C.
        </p>
        <p className="font-grotesk text-xs font-semibold" style={{ color: "#FCD34D" }}>
          🌿 The Cool Route is strongly recommended.
        </p>
      </div>
    );
  }

  // Evening
  return (
    <div
      className="pointer-events-auto rounded-2xl p-4"
      style={{
        background: "rgba(16,185,129,0.08)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(16,185,129,0.25)",
        boxShadow: "0 0 12px rgba(16,185,129,0.15), 0 8px 24px rgba(0,0,0,0.5)",
        animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{hour >= 18 ? "🌙" : "🌅"}</span>
          <p className="font-grotesk font-bold text-sm" style={{ color: "var(--jade-light)" }}>
            Pleasant conditions
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 w-5 h-5 rounded-lg flex items-center justify-center text-xs transition-all duration-150"
          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "var(--jade-light)" }}
        >
          ✕
        </button>
      </div>
      <p className="font-grotesk text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Evening conditions are comfortable. Both routes are pleasant right now.
      </p>
    </div>
  );
}
