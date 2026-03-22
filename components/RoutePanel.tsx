"use client";

import type { ScoredRoute } from "@/lib/shadeScoring";
import { formatDuration, formatDistance } from "@/lib/shadeScoring";

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
        <p className="text-xs font-syne" style={{ color: "#FCA5A5" }}>
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
          theme="jade"
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
          theme="amber"
          headerGradient="linear-gradient(135deg, #F59E0B, #D97706)"
          glowColor="var(--amber-glow)"
          borderColor="var(--border-amber)"
          statColor="var(--amber-light)"
          route={fastRoute}
        />
      )}

      <p
        className="text-[10px] text-center font-syne tracking-wide"
        style={{ color: "var(--text-muted)" }}
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
  theme: "jade" | "amber";
  headerGradient: string;
  glowColor: string;
  borderColor: string;
  statColor: string;
  route: ScoredRoute;
  badge?: string;
}) {
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
        <span className="flex items-center gap-2 font-syne font-bold text-sm text-white">
          <span>{icon}</span>
          {label}
        </span>
        {badge && (
          <span
            className="text-[10px] font-syne font-bold px-2 py-0.5 rounded-full"
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

      {/* Stats row */}
      <div
        className="grid grid-cols-3 py-3"
        style={{ borderBottom: `1px solid rgba(148,163,184,0.08)` }}
      >
        <Stat value={formatDistance(route.distance)} label="Distance" statColor={statColor} />
        <Stat value={formatDuration(route.time)} label="Walk time" statColor={statColor} />
        <Stat value={`${route.shadePct}%`} label="Shade" statColor={statColor} highlight />
      </div>

      {/* Shade progress bar */}
      <div className="px-4 py-3">
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

/* ── Stat cell ─────────────────────────────────────────────────────────────── */
function Stat({
  value,
  label,
  statColor,
  highlight = false,
}: {
  value: string;
  label: string;
  statColor: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 px-2"
      style={
        highlight
          ? { borderLeft: "1px solid rgba(148,163,184,0.08)" }
          : {}
      }
    >
      <span
        className="font-syne font-bold text-base leading-tight"
        style={{ color: statColor }}
      >
        {value}
      </span>
      <span
        className="font-syne text-[9px] uppercase tracking-[0.12em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}
