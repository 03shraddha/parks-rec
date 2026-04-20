"use client";

import { useState } from "react";

interface OnboardingOverlayProps {
  onClose: () => void;
}

const STEPS = [
  {
    title: "Set your start",
    description: 'Tap "Set start" and search for your current location - or drop a pin anywhere on the map.',
    icon: "📍",
    color: "var(--jade-light)",
    glow: "var(--jade-glow)",
    gradient: "linear-gradient(135deg, var(--jade), #059669)",
    border: "var(--border-jade)",
  },
  {
    title: "Set your destination",
    description: 'Tap "Set end" and choose where you want to go. Any address, landmark, or map tap works.',
    icon: "🏁",
    color: "var(--amber-light)",
    glow: "var(--amber-glow)",
    gradient: "linear-gradient(135deg, var(--amber), #D97706)",
    border: "var(--border-amber)",
  },
  {
    title: "Compare your routes",
    description: "We'll find you two routes - the fastest and the coolest. Pick the shaded one to beat the Bengaluru heat.",
    icon: "🌿",
    color: "var(--violet-light)",
    glow: "var(--violet-glow)",
    gradient: "linear-gradient(135deg, var(--violet), #6D28D9)",
    border: "var(--border-violet)",
  },
];

export default function OnboardingOverlay({ onClose }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleClose = () => {
    localStorage.setItem("onboarding_done", "1");
    onClose();
  };

  return (
    // Full-screen backdrop - click outside card to dismiss
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:pb-0"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}
      onClick={handleClose}
    >
      {/* Card - stop propagation so clicks inside don't dismiss */}
      <div
        className="w-[calc(100%-2rem)] max-w-sm rounded-2xl overflow-y-auto pointer-events-auto"
        style={{
          maxHeight: "90dvh",
          background: "var(--bg-card)",
          backdropFilter: "blur(24px) saturate(180%)",
          border: `1px solid ${current.border}`,
          boxShadow: `0 0 24px ${current.glow}, 0 16px 48px rgba(0,0,0,0.7)`,
          animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Coloured top accent */}
        <div className="h-0.5 w-full" style={{ background: current.gradient }} />

        {/* Header: step count + skip */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span
            className="font-mono-ui uppercase tracking-[0.16em]"
            style={{ fontSize: "9px", color: "var(--text-disabled)" }}
          >
            {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={handleClose}
            className="font-mono-ui uppercase tracking-[0.12em] text-[9px] px-2.5 py-1 rounded-lg transition-all duration-150"
            style={{
              background: "rgba(148,163,184,0.08)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
            }}
          >
            Skip
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 px-5 pb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === step ? "24px" : "8px",
                background: i === step ? current.gradient : "var(--border-subtle)",
              }}
            />
          ))}
        </div>

        {/* Icon + title */}
        <div className="px-5 pb-2 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{
              background: current.gradient,
              boxShadow: `0 0 12px ${current.glow}`,
            }}
          >
            {current.icon}
          </div>
          <h2
            className="font-grotesk font-bold text-xl leading-tight"
            style={{ color: "var(--text-display)", textShadow: `0 0 16px ${current.glow}` }}
          >
            {current.title}
          </h2>
        </div>

        {/* Description */}
        <p
          className="font-grotesk text-sm leading-relaxed px-5 pb-5"
          style={{ color: "var(--text-secondary)" }}
        >
          {current.description}
        </p>

        {/* CTA button */}
        <div className="px-5 pb-5">
          <button
            onClick={isLast ? handleClose : () => setStep((s) => s + 1)}
            className="w-full py-3 rounded-xl font-grotesk font-bold text-sm transition-all duration-200"
            style={{
              background: current.gradient,
              color: "#fff",
              border: `1px solid ${current.border}`,
              boxShadow: `0 0 16px ${current.glow}, 0 4px 16px rgba(0,0,0,0.4)`,
              letterSpacing: "0.03em",
            }}
          >
            {isLast ? "Let's go ✦" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
