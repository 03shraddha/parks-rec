"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GHInstruction, Coordinate } from "@/lib/graphhopper";
import type { ScoredRoute } from "@/lib/shadeScoring";

interface NavigationPanelProps {
  route: ScoredRoute;
  routeType: "cool" | "fast";
  onExit: () => void;
  onPositionUpdate?: (coord: Coordinate) => void;
  onNavUpdate?: (coord: Coordinate, bearing: number) => void;
  onStepChange?: (stepIndex: number) => void;
}

function signToArrow(sign: number): string {
  switch (sign) {
    case -3: return "↰";
    case -2: return "↖";
    case -1: return "↗";
    case 0:  return "↑";
    case 1:  return "↗";
    case 2:  return "↗";
    case 3:  return "↱";
    case 4:  return "⬤";
    case 5:  return "↷";
    case 7:  return "↻";
    default: return "↑";
  }
}

function signToLabel(sign: number): string {
  switch (sign) {
    case -3: return "Sharp left";
    case -2: return "Turn left";
    case -1: return "Keep left";
    case 0:  return "Continue";
    case 1:  return "Keep right";
    case 2:  return "Turn right";
    case 3:  return "Sharp right";
    case 4:  return "Arrive";
    case 5:  return "U-turn";
    case 7:  return "Roundabout";
    default: return "Continue";
  }
}

function formatDist(m: number): string {
  if (m < 50) return "arriving";
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function haversineDistance(a: Coordinate, b: Coordinate): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

export default function NavigationPanel({ route, routeType, onExit, onPositionUpdate, onNavUpdate, onStepChange }: NavigationPanelProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [distToNext, setDistToNext] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const routeCoords = route.points.coordinates;
  const instructions: GHInstruction[] = route.instructions ?? [];
  const accentColor = routeType === "cool" ? "var(--jade-light)" : "var(--amber-light)";
  const accentGlow = routeType === "cool" ? "var(--jade-glow)" : "var(--amber-glow)";

  const advanceStep = useCallback((pos: Coordinate) => {
    if (!instructions.length) return;
    const current = instructions[stepIdx];
    if (!current) return;

    // Get the waypoint coordinate for the end of this step
    const endIdx = current.interval[1];
    const [eLng, eLat] = routeCoords[Math.min(endIdx, routeCoords.length - 1)];
    const dist = haversineDistance(pos, { lng: eLng, lat: eLat });
    setDistToNext(dist);

    // Auto-advance when within 20 m of the step endpoint
    if (dist < 20 && stepIdx < instructions.length - 1) {
      const next = stepIdx + 1;
      setStepIdx(next);
      onStepChange?.(next);
    }
  }, [stepIdx, instructions, routeCoords, onStepChange]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coord: Coordinate = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        // heading is degrees from north (0-360), or null if unavailable on the device
        const hdg = pos.coords.heading ?? 0;
        setHeading(pos.coords.heading);
        onPositionUpdate?.(coord);
        onNavUpdate?.(coord, hdg);
        advanceStep(coord);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [advanceStep, onPositionUpdate, onNavUpdate]);

  const current = instructions[stepIdx];
  const next = instructions[stepIdx + 1];
  const remainingSteps = instructions.slice(stepIdx);
  const remainingTime = Math.round(remainingSteps.reduce((s, i) => s + i.time, 0) / 60000);
  const remainingDist = remainingSteps.reduce((s, i) => s + i.distance, 0);
  const isArriving = current?.sign === 4;

  return (
    <div
      className="pointer-events-auto flex flex-col"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderRadius: "24px 24px 0 0",
        background: "var(--bg-card)",
        backdropFilter: "blur(24px) saturate(180%)",
        border: `1px solid ${accentColor}44`,
        boxShadow: `0 -4px 32px ${accentGlow}, 0 -1px 0 ${accentColor}33`,
        maxHeight: expanded ? "80vh" : "auto",
        transition: "max-height 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: `${accentColor}55` }} />
      </div>

      {/* Current step - large, prominent */}
      <div className="px-5 py-3" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        <div className="flex items-start gap-4">
          {/* Turn arrow */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{
              background: `${accentColor}18`,
              border: `1.5px solid ${accentColor}44`,
              boxShadow: `0 0 12px ${accentGlow}`,
              color: accentColor,
            }}
          >
            {current ? signToArrow(current.sign) : "↑"}
          </div>

          <div className="flex-1 min-w-0">
            {/* Distance to next turn */}
            {distToNext !== null && (
              <p className="font-zen font-black text-4xl leading-none" style={{ color: accentColor }}>
                {formatDist(distToNext)}
              </p>
            )}
            {/* Instruction text */}
            <p className="font-grotesk font-semibold text-base leading-snug mt-0.5" style={{ color: "var(--text-display)" }}>
              {current ? (isArriving ? "You have arrived!" : (current.text || signToLabel(current.sign))) : "Starting navigation..."}
            </p>
            {/* Next step preview */}
            {next && !isArriving && (
              <p className="font-grotesk text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Then: {next.text || signToLabel(next.sign)}
              </p>
            )}
          </div>

          {/* Collapse/expand toggle */}
          <button
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm"
            style={{ background: "rgba(148,163,184,0.08)", color: "var(--text-muted)" }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? "↓" : "↑"}
          </button>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-3 mt-3">
          <span className="font-mono-ui text-[10px] uppercase tracking-[.12em]" style={{ color: "var(--text-disabled)" }}>
            {remainingTime} min left
          </span>
          <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-disabled)" }} />
          <span className="font-mono-ui text-[10px] uppercase tracking-[.12em]" style={{ color: "var(--text-disabled)" }}>
            {formatDist(remainingDist)}
          </span>
          <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-disabled)" }} />
          <span className="font-mono-ui text-[10px] uppercase tracking-[.12em]" style={{ color: "var(--text-disabled)" }}>
            {stepIdx + 1} / {instructions.length} steps
          </span>
        </div>
      </div>

      {/* Progress bar - how far through the route the user is */}
      <div className="px-5 pb-1">
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(148,163,184,0.1)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${instructions.length > 0 ? (stepIdx / instructions.length) * 100 : 0}%`,
              background: accentColor,
              boxShadow: `0 0 6px ${accentGlow}`,
            }}
          />
        </div>
      </div>

      {/* Compass indicator - only show when heading is available */}
      {heading !== null && heading > 0 && (
        <div className="flex items-center gap-2 px-5 pb-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
            style={{
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}33`,
              transform: `rotate(${heading}deg)`,
              transition: "transform 0.5s ease",
              color: accentColor,
            }}
          >
            &#9650;
          </div>
          <span className="font-mono-ui text-[10px] uppercase tracking-[.10em]" style={{ color: "var(--text-disabled)" }}>
            {Math.round(heading)}{"\u00b0"} heading
          </span>
        </div>
      )}

      {/* Arrival celebration state */}
      {isArriving && (
        <div className="px-5 py-4 text-center">
          <p className="font-zen text-2xl font-black" style={{ color: accentColor }}>You arrived!</p>
          <p className="font-grotesk text-sm mt-1" style={{ color: "var(--text-muted)" }}>Great walk!</p>
        </div>
      )}

      {/* Expandable step list */}
      {expanded && (
        <div className="overflow-y-auto px-4 pb-2" style={{ maxHeight: "45vh", scrollbarWidth: "thin" }}>
          <div className="h-px mb-3" style={{ background: "rgba(148,163,184,0.10)" }} />
          {instructions.map((instr, i) => (
            <button
              key={i}
              onClick={() => { setStepIdx(i); onStepChange?.(i); }}
              className="w-full flex items-center gap-3 py-2.5 text-left"
              style={{
                borderBottom: i < instructions.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none",
                opacity: i < stepIdx ? 0.4 : 1,
              }}
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{
                  background: i === stepIdx ? `${accentColor}22` : "rgba(148,163,184,0.06)",
                  color: i === stepIdx ? accentColor : "var(--text-muted)",
                  border: i === stepIdx ? `1px solid ${accentColor}44` : "1px solid transparent",
                }}
              >
                {signToArrow(instr.sign)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-grotesk text-sm leading-snug" style={{ color: i === stepIdx ? "var(--text-display)" : "var(--text-primary)" }}>
                  {instr.text || signToLabel(instr.sign)}
                </p>
                <p className="font-mono-ui text-[9px] uppercase tracking-[.10em] mt-0.5" style={{ color: "var(--text-disabled)" }}>
                  {formatDist(instr.distance)}
                </p>
              </div>
              {i < stepIdx && (
                <span style={{ color: accentColor, fontSize: "12px" }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* End navigation button */}
      <div className="px-4 pb-5 pt-2">
        <button
          onClick={onExit}
          className="w-full py-4 rounded-2xl font-grotesk text-base font-bold"
          style={{
            background: "rgba(248,113,113,0.12)",
            color: "#F87171",
            border: "1px solid rgba(248,113,113,0.25)",
          }}
        >
          End Navigation
        </button>
      </div>
    </div>
  );
}
