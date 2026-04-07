"use client";

import type { ScoredRoute } from "@/lib/shadeScoring";
import { formatDuration } from "@/lib/shadeScoring";

interface RouteComparisonBarProps {
  fastRoute: ScoredRoute | null;
  coolRoute: ScoredRoute | null;
}

export default function RouteComparisonBar({ fastRoute, coolRoute }: RouteComparisonBarProps) {
  if (!fastRoute || !coolRoute) return null;

  const fastMins = Math.round(fastRoute.time / 60000);
  const coolMins = Math.round(coolRoute.time / 60000);
  const timeDelta = coolMins - fastMins;
  const shadeDelta = coolRoute.shadePct - fastRoute.shadePct;
  const isWorthIt = shadeDelta > 5; // jade highlight only when meaningfully more shade

  return (
    <div
      className="pointer-events-auto rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
        animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Fast route side */}
      <div className="flex flex-col items-start min-w-0">
        <span className="font-grotesk font-bold text-sm leading-none" style={{ color: "var(--amber-light)" }}>
          ⚡ {formatDuration(fastRoute.time)}
        </span>
        <span
          className="font-mono-ui uppercase mt-0.5"
          style={{ fontSize: "8px", letterSpacing: "0.12em", color: "var(--text-disabled)" }}
        >
          {fastRoute.shadePct}% shade
        </span>
      </div>

      {/* Centre delta */}
      <div className="flex flex-col items-center flex-1 min-w-0 px-1">
        <span
          className="font-grotesk font-semibold text-xs leading-tight text-center"
          style={{ color: isWorthIt ? "var(--jade-light)" : "var(--text-muted)" }}
        >
          {timeDelta > 0 ? `+${timeDelta}min` : timeDelta === 0 ? "same time" : `${timeDelta}min`}
          {" · "}
          {shadeDelta >= 0 ? `+${shadeDelta}%` : `${shadeDelta}%`} shade
        </span>
        <span
          className="font-mono-ui uppercase mt-0.5"
          style={{ fontSize: "7px", letterSpacing: "0.10em", color: "var(--text-disabled)" }}
        >
          cool vs fast
        </span>
      </div>

      {/* Cool route side */}
      <div className="flex flex-col items-end min-w-0">
        <span className="font-grotesk font-bold text-sm leading-none" style={{ color: "var(--jade-light)" }}>
          🌿 {formatDuration(coolRoute.time)}
        </span>
        <span
          className="font-mono-ui uppercase mt-0.5"
          style={{ fontSize: "8px", letterSpacing: "0.12em", color: "var(--text-disabled)" }}
        >
          {coolRoute.shadePct}% shade
        </span>
      </div>
    </div>
  );
}
