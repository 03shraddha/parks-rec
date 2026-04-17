"use client";

import { useState } from "react";
import type { EventInfo } from "./Map";

interface EventFeature {
  properties: EventInfo;
  geometry: { type: string; coordinates: [number, number] };
}

interface EventsPanelProps {
  events: EventFeature[];
  onEventSelect: (lng: number, lat: number, info: EventInfo) => void;
  onClose: () => void;
  onLocationSearch?: (location: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Fitness:     "#F472B6",
  Cultural:    "#C084FC",
  Nature:      "#86EFAC",
  Wellness:    "#67E8F9",
  Heritage:    "#FCD34D",
  Running:     "#FB923C",
  Cycling:     "#60A5FA",
  Environment: "#4ADE80",
};

function getEventTiming(date: string): string {
  const d = date.toLowerCase();
  if (d.includes("every")) return "Regular";
  if (d.includes("first") || d.includes("second") || d.includes("third") || d.includes("last")) return "Monthly";
  if (d.includes("season") || d.includes("day")) return "Seasonal";
  return "Upcoming";
}

const TIMING_COLORS: Record<string, string> = {
  Regular:  "#86EFAC",
  Monthly:  "#C084FC",
  Seasonal: "#FCD34D",
  Upcoming: "#60A5FA",
};

export default function EventsPanel({ events, onEventSelect, onClose, onLocationSearch }: EventsPanelProps) {
  const [locationQuery, setLocationQuery] = useState("");

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = locationQuery.trim();
    if (q && onLocationSearch) onLocationSearch(q);
  };

  return (
    <div
      className="pointer-events-auto rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(244, 114, 182, 0.18)",
        boxShadow: "0 0 16px rgba(244,114,182,0.25), 0 12px 40px rgba(0,0,0,0.6)",
        width: "260px",
        maxHeight: "480px",
        animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Pink top accent */}
      <div className="h-0.5 w-full shrink-0" style={{ background: "linear-gradient(90deg, #F472B6, #EC4899)" }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 shrink-0" style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
        <div>
          <p className="font-grotesk font-bold text-sm" style={{ color: "var(--text-display)" }}>
            🎉 Events Near You
          </p>
          <p className="font-mono-ui uppercase tracking-[0.10em]" style={{ fontSize: "8px", color: "var(--text-disabled)", marginTop: "1px" }}>
            {events.length} events · Bengaluru
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close events panel"
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-all duration-150"
          style={{
            background: "rgba(148,163,184,0.08)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#F472B6";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(244,114,182,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(148,163,184,0.08)";
          }}
        >
          ✕
        </button>
      </div>

      {/* Location search input */}
      {onLocationSearch && (
        <form onSubmit={handleLocationSubmit} className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: "var(--bg-surface)", border: "1px solid rgba(244,114,182,0.25)" }}
          >
            <svg className="w-3 h-3 shrink-0" style={{ color: "#F472B6" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="Search near neighbourhood…"
              className="flex-1 bg-transparent text-xs outline-none min-w-0 font-grotesk"
              style={{ color: "var(--text-primary)" }}
            />
            <button type="submit" className="shrink-0 text-[10px] font-grotesk font-semibold px-2 py-0.5 rounded-lg" style={{ background: "rgba(244,114,182,0.2)", color: "#F472B6", border: "1px solid rgba(244,114,182,0.3)" }}>
              Go
            </button>
          </div>
        </form>
      )}

      {/* Scrollable event list */}
      <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(244,114,182,0.3) transparent" }}>
        {events.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="font-grotesk text-xs" style={{ color: "var(--text-muted)" }}>No events loaded yet.</p>
          </div>
        ) : (
          events.map((feature, i) => {
            const info = feature.properties;
            const [lng, lat] = feature.geometry.coordinates;
            const catColor = CATEGORY_COLORS[info.category] ?? "#F472B6";
            const timing = getEventTiming(info.date);
            const timingColor = TIMING_COLORS[timing];

            return (
              <button
                key={i}
                onClick={() => onEventSelect(lng, lat, info)}
                className="w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors duration-100"
                style={{
                  borderBottom: i < events.length - 1 ? "1px solid rgba(148,163,184,0.07)" : "none",
                  background: "transparent",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(244,114,182,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {/* Top row: category badge + timing badge */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="font-mono-ui uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: "8px", background: `${catColor}22`, border: `1px solid ${catColor}44`, color: catColor }}
                  >
                    {info.category}
                  </span>
                  <span
                    className="font-mono-ui uppercase tracking-[0.10em] px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: "8px", background: `${timingColor}18`, border: `1px solid ${timingColor}33`, color: timingColor }}
                  >
                    {timing}
                  </span>
                </div>

                {/* Event title */}
                <p className="font-grotesk font-semibold text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
                  {info.title}
                </p>

                {/* Venue + time */}
                <p className="font-grotesk text-xs" style={{ color: "var(--text-muted)" }}>
                  {info.venue} · {info.time}
                </p>

                {/* Date */}
                <p
                  className="font-mono-ui uppercase tracking-[0.08em]"
                  style={{ fontSize: "8px", color: "var(--text-disabled)" }}
                >
                  {info.date}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 shrink-0" style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
        <p className="font-mono-ui uppercase tracking-[0.08em] text-center" style={{ fontSize: "8px", color: "var(--text-disabled)" }}>
          Tap an event to zoom in on the map
        </p>
      </div>
    </div>
  );
}
