"use client";

import { useState } from "react";
import type { ScoredRoute } from "@/lib/shadeScoring";
import { formatDuration, formatDistance } from "@/lib/shadeScoring";
import ShadeExplainerTooltip from "./ShadeExplainerTooltip";

interface RoutePanelProps {
  fastRoute: ScoredRoute | null;
  coolRoute: ScoredRoute | null;
  loading: boolean;
  error: string | null;
}

export default function RoutePanel({ fastRoute, coolRoute, loading, error }: RoutePanelProps) {
  /* ── Loading state — shimmer + glowing spinner ── */
  if (loading) {
    return (
      <div
        className="pointer-events-auto anime-panel glow-violet rounded-2xl p-4 flex items-center gap-3"
      >
        {/* Spinning neon ring */}
        <div
          className="w-5 h-5 rounded-full shrink-0"
          style={{
            border: "2px solid transparent",
            borderTopColor: "var(--jade-light)",
            borderRightColor: "var(--violet-light)",
            animation: "spin 0.8s linear infinite",
            boxShadow: "0 0 8px var(--jade-glow)",
          }}
        />
        <div className="flex-1">
          {/* Shimmer text placeholders */}
          <div
            className="shimmer h-3 rounded-full mb-1.5"
            style={{ width: "60%", borderRadius: "4px" }}
          />
          <div
            className="shimmer h-2.5 rounded-full"
            style={{ width: "40%", borderRadius: "4px" }}
          />
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div
        className="pointer-events-auto rounded-2xl p-4"
        style={{
          background: "rgba(220, 38, 38, 0.12)",
          border: "1px solid rgba(248, 113, 113, 0.35)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 0 12px rgba(220,38,38,0.25), 0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <p className="font-grotesk text-xs" style={{ color: "#FCA5A5" }}>
          ⚠ {error}
        </p>
      </div>
    );
  }

  if (!fastRoute && !coolRoute) return null;

  const shadeDiff =
    coolRoute && fastRoute ? coolRoute.shadePct - fastRoute.shadePct : null;

  return (
    <div className="pointer-events-auto flex flex-col gap-2.5">
      {/* Cool Route — jade/teal theme */}
      {coolRoute && (
        <RouteCard
          label="Cool Route"
          icon="🌿"
          headerGradient="linear-gradient(135deg, #10B981, #059669)"
          glowColor="var(--jade-glow)"
          borderColor="var(--border-jade)"
          statColor="var(--jade-light)"
          route={coolRoute}
          badge={
            shadeDiff !== null && shadeDiff > 0
              ? `+${shadeDiff}% shade`
              : undefined
          }
        />
      )}

      {/* Fast Route — amber/gold theme */}
      {fastRoute && (
        <RouteCard
          label="Fast Route"
          icon="⚡"
          headerGradient="linear-gradient(135deg, #F59E0B, #D97706)"
          glowColor="var(--amber-glow)"
          borderColor="var(--border-amber)"
          statColor="var(--amber-light)"
          route={fastRoute}
        />
      )}

      {/* TERTIARY hint — Space Mono ALL CAPS */}
      <p
        className="font-mono-ui text-[9px] text-center uppercase tracking-[0.12em]"
        style={{ color: "var(--text-disabled)" }}
      >
        Tap a route segment on the map for details
      </p>
    </div>
  );
}

/* ── Route Card ────────────────────────────────────────────────────────────── */
function RouteCard({
  label,
  icon,
  headerGradient,
  glowColor,
  borderColor,
  statColor,
  route,
  badge,
}: {
  label: string;
  icon: string;
  headerGradient: string;
  glowColor: string;
  borderColor: string;
  statColor: string;
  route: ScoredRoute;
  badge?: string;
}) {
  const [showExplainer, setShowExplainer] = useState(false);
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${borderColor}`,
        boxShadow: `0 0 14px ${glowColor}, 0 8px 32px rgba(0,0,0,0.55)`,
        animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Gradient header bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: headerGradient }}
      >
        <span className="flex items-center gap-2 font-grotesk font-bold text-sm text-white">
          <span>{icon}</span>
          {label}
        </span>
        {badge && (
          <span
            className="font-mono-ui text-[9px] uppercase tracking-[0.10em] px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.22)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.30)",
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Stats — three-layer hierarchy */}
      <div className="px-4 pt-3 pb-1">
        {/* PRIMARY: Walk time — the hero number, seen first */}
        <div className="flex items-baseline gap-1 mb-0.5">
          <span
            className="font-grotesk font-bold leading-none"
            style={{ fontSize: "2.5rem", color: statColor }}
          >
            {formatDuration(route.time)}
          </span>
        </div>
        {/* TERTIARY label for the hero */}
        <p
          className="font-mono-ui uppercase tracking-[0.14em] mb-3"
          style={{ fontSize: "9px", color: "var(--text-disabled)" }}
        >
          Walk time
        </p>

        {/* SECONDARY: Distance — grouped tight (8px) to primary */}
        <div className="flex items-baseline gap-1 mb-0.5">
          <span
            className="font-grotesk font-semibold text-base leading-none"
            style={{ color: "var(--text-primary)" }}
          >
            {formatDistance(route.distance)}
          </span>
        </div>
        {/* TERTIARY label for secondary stat */}
        <p
          className="font-mono-ui uppercase tracking-[0.14em] mb-3"
          style={{ fontSize: "9px", color: "var(--text-disabled)" }}
        >
          Distance
        </p>
      </div>

      {/* ONE VISUAL BREAK — Shade % absurdly prominent against the rest */}
      <div
        className="mx-4 mb-3 px-3 py-2 rounded-xl flex items-center justify-between"
        style={{
          background: "rgba(148,163,184,0.06)",
          border: `1px solid ${borderColor}`,
        }}
      >
        <div className="flex items-center gap-1.5 relative">
          <p className="font-mono-ui uppercase tracking-[0.14em]" style={{ fontSize: "9px", color: "var(--text-disabled)" }}>
            Shade cover
          </p>
          <button
            onClick={() => setShowExplainer((v) => !v)}
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-150"
            style={{
              background: "rgba(148,163,184,0.10)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
              fontSize: "7px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
            aria-label="What is shade cover?"
          >
            ?
          </button>
          <ShadeExplainerTooltip visible={showExplainer} onClose={() => setShowExplainer(false)} />
        </div>
        <span
          className="font-grotesk font-bold leading-none"
          style={{ fontSize: "1.75rem", color: statColor, textShadow: `0 0 12px ${glowColor}` }}
        >
          {route.shadePct}
          <span className="text-sm font-semibold">%</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(148,163,184,0.12)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${route.shadePct}%`,
              background: headerGradient,
              boxShadow: `0 0 6px ${glowColor}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* Stat component removed — hierarchy is now rendered inline in RouteCard */
