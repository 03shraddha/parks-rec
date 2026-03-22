"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import LayerControls from "@/components/LayerControls";
import RoutePanel from "@/components/RoutePanel";
import SegmentPopup from "@/components/SegmentPopup";
import type { LayerVisibility, PinMode } from "@/components/Map";
import type { ScoredRoute, SegmentInfo } from "@/lib/shadeScoring";
import type { Coordinate } from "@/lib/graphhopper";

// MapLibre uses browser APIs — must be client-only
const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function HomePage() {
  // ── Map interaction state ────────────────────────────────────────────────
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [origin, setOrigin] = useState<Coordinate | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);

  // ── Layer visibility ─────────────────────────────────────────────────────
  const [visibleLayers, setVisibleLayers] = useState<LayerVisibility>({
    trees: false,
    parks: false,
    lakes: false,
    heat: false,
    busStops: false,
  });

  // ── Route state ──────────────────────────────────────────────────────────
  const [fastRoute, setFastRoute] = useState<ScoredRoute | null>(null);
  const [coolRoute, setCoolRoute] = useState<ScoredRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // ── Segment popup ────────────────────────────────────────────────────────
  const [segmentInfo, setSegmentInfo] = useState<SegmentInfo | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const fetchRoute = useCallback(
    async (orig: Coordinate, dest: Coordinate) => {
      setRouteLoading(true);
      setRouteError(null);
      setFastRoute(null);
      setCoolRoute(null);
      setSegmentInfo(null);

      try {
        const resp = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: orig, destination: dest }),
        });
        if (!resp.ok) {
          const { error } = await resp.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(error ?? `Request failed (${resp.status})`);
        }
        const data = await resp.json();
        setFastRoute(data.fastRoute);
        setCoolRoute(data.coolRoute);
      } catch (err) {
        setRouteError(err instanceof Error ? err.message : "Could not find a route.");
      } finally {
        setRouteLoading(false);
      }
    },
    []
  );

  const handlePinDrop = useCallback(
    async (mode: "origin" | "destination", coord: Coordinate) => {
      setPinMode(null);

      let nextOrigin = origin;
      let nextDest = destination;

      if (mode === "origin") {
        setOrigin(coord);
        nextOrigin = coord;
      } else {
        setDestination(coord);
        nextDest = coord;
      }

      if (nextOrigin && nextDest) {
        await fetchRoute(nextOrigin, nextDest);
      }
    },
    [origin, destination, fetchRoute]
  );

  const toggleLayer = useCallback((key: keyof LayerVisibility) => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleReset = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setFastRoute(null);
    setCoolRoute(null);
    setRouteError(null);
    setSegmentInfo(null);
    setPinMode(null);
  }, []);

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <main className="relative w-screen h-screen overflow-hidden" style={{ background: "var(--bg-deep)" }}>
      {/* Full-screen map */}
      <Map
        pinMode={pinMode}
        origin={origin}
        destination={destination}
        fastRoute={fastRoute}
        coolRoute={coolRoute}
        visibleLayers={visibleLayers}
        onPinDrop={handlePinDrop}
        onSegmentClick={setSegmentInfo}
      />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pointer-events-none z-10">
        {/* Brand */}
        <div
          className="pointer-events-auto anime-panel glow-violet rounded-2xl px-4 py-2.5 flex items-center gap-3"
          style={{ minWidth: 0 }}
        >
          {/* Animated nature icon */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-lg"
            style={{
              background: "linear-gradient(135deg, var(--jade), var(--cyan))",
              boxShadow: "0 0 12px var(--jade-glow)",
            }}
          >
            🌿
          </div>
          <div>
            <p
              className="font-syne font-bold leading-tight text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              Walk the City
            </p>
            <p
              className="text-[10px] leading-tight tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Without melting · Bengaluru
            </p>
          </div>
        </div>

        {/* Reset button */}
        {(origin || destination) && (
          <button
            onClick={handleReset}
            className="pointer-events-auto font-syne text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200"
            style={{
              background: "rgba(124, 58, 237, 0.15)",
              border: "1px solid var(--border-violet)",
              color: "var(--violet-light)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 0 10px var(--violet-glow)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124, 58, 237, 0.30)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124, 58, 237, 0.15)";
            }}
          >
            ↺ Reset
          </button>
        )}
      </header>

      {/* ── Bottom layout ─────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col md:flex-row items-end justify-between p-4 gap-3 pointer-events-none z-10">

        {/* Layer controls — bottom left */}
        <div className="w-full md:w-auto">
          <LayerControls visible={visibleLayers} onChange={toggleLayer} />
        </div>

        {/* Pin controls + route panel — bottom right */}
        <div className="w-full md:w-72 flex flex-col gap-3">
          <PinControls
            origin={origin}
            destination={destination}
            pinMode={pinMode}
            onSetMode={setPinMode}
            onFetchRoute={fetchRoute}
          />
          <RoutePanel
            fastRoute={fastRoute}
            coolRoute={coolRoute}
            loading={routeLoading}
            error={routeError}
          />
        </div>
      </div>

      {/* ── Segment popup ─────────────────────────────────────────────────── */}
      {segmentInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:top-20 md:right-4 z-20">
          <SegmentPopup info={segmentInfo} onClose={() => setSegmentInfo(null)} />
        </div>
      )}

      {/* ── Pin-drop instruction banner ───────────────────────────────────── */}
      {pinMode && (
        <div
          className="absolute top-20 left-1/2 pointer-events-none z-20"
          style={{ animation: "banner-float 2.4s ease-in-out infinite" }}
        >
          <div
            className="font-syne text-sm font-semibold px-5 py-2.5 rounded-full whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.90), rgba(236,72,153,0.80))",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(167, 139, 250, 0.4)",
              color: "#fff",
              boxShadow: "0 0 20px var(--violet-glow), 0 8px 32px rgba(0,0,0,0.5)",
              letterSpacing: "0.02em",
            }}
          >
            {pinMode === "origin"
              ? "✦ Tap the map to set your start"
              : "✦ Tap the map to set your destination"}
          </div>
        </div>
      )}
    </main>
  );
}

// ── Pin Controls Component ─────────────────────────────────────────────────
function PinControls({
  origin,
  destination,
  pinMode,
  onSetMode,
  onFetchRoute,
}: {
  origin: Coordinate | null;
  destination: Coordinate | null;
  pinMode: PinMode;
  onSetMode: (m: PinMode) => void;
  onFetchRoute: (o: Coordinate, d: Coordinate) => void;
}) {
  return (
    <div className="pointer-events-auto anime-panel glow-violet rounded-2xl p-3 flex flex-col gap-2.5">
      {/* Label */}
      <p
        className="font-syne text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{ color: "var(--violet-light)" }}
      >
        ✦ Drop pins to find routes
      </p>

      <div className="flex gap-2">
        {/* Origin / Start pin */}
        <button
          onClick={() => onSetMode(pinMode === "origin" ? null : "origin")}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
          style={
            pinMode === "origin"
              ? {
                  background: "linear-gradient(135deg, var(--jade), #059669)",
                  border: "1px solid var(--jade)",
                  color: "#fff",
                  boxShadow: "0 0 14px var(--jade-glow)",
                }
              : origin
              ? {
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid var(--border-jade)",
                  color: "var(--jade-light)",
                }
              : {
                  background: "rgba(148, 163, 184, 0.06)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }
          }
        >
          {/* Pin marker */}
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{
              background: origin
                ? "linear-gradient(135deg, var(--jade), #059669)"
                : "var(--text-muted)",
              boxShadow: origin ? "0 0 8px var(--jade-glow)" : "none",
            }}
          >
            A
          </span>
          {origin ? "Start set" : "Set start"}
        </button>

        {/* Destination pin */}
        <button
          onClick={() => onSetMode(pinMode === "destination" ? null : "destination")}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
          style={
            pinMode === "destination"
              ? {
                  background: "linear-gradient(135deg, var(--amber), #D97706)",
                  border: "1px solid var(--amber)",
                  color: "#fff",
                  boxShadow: "0 0 14px var(--amber-glow)",
                }
              : destination
              ? {
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid var(--border-amber)",
                  color: "var(--amber-light)",
                }
              : {
                  background: "rgba(148, 163, 184, 0.06)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }
          }
        >
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{
              background: destination
                ? "linear-gradient(135deg, var(--amber), #D97706)"
                : "var(--text-muted)",
              boxShadow: destination ? "0 0 8px var(--amber-glow)" : "none",
            }}
          >
            B
          </span>
          {destination ? "End set" : "Set end"}
        </button>
      </div>

      {/* Refetch button — only when both pins are set */}
      {origin && destination && (
        <button
          onClick={() => onFetchRoute(origin, destination)}
          className="w-full py-2.5 rounded-xl font-syne text-sm font-bold transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, var(--violet), #6D28D9)",
            color: "#fff",
            border: "1px solid rgba(167, 139, 250, 0.4)",
            boxShadow: "0 0 16px var(--violet-glow), 0 4px 16px rgba(0,0,0,0.4)",
            letterSpacing: "0.03em",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 28px var(--violet-glow), 0 4px 24px rgba(0,0,0,0.5)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 16px var(--violet-glow), 0 4px 16px rgba(0,0,0,0.4)";
          }}
        >
          ✦ Find Cool Routes
        </button>
      )}
    </div>
  );
}
