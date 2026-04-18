"use client";

import type { EventInfo } from "./Map";

interface EventPopupProps {
  info: EventInfo;
  onClose: () => void;
  onGetDirections?: (lng: number, lat: number) => void;
}

const PINK_GLOW = "rgba(244, 114, 182, 0.45)";
const PINK_GRADIENT = "linear-gradient(135deg, #F472B6, #EC4899)";

export default function EventPopup({ info, onClose, onGetDirections }: EventPopupProps) {
  const pinkGlow = PINK_GLOW;
  const pinkGradient = PINK_GRADIENT;

  return (
    <div
      className="pointer-events-auto rounded-2xl overflow-hidden w-64"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(244, 114, 182, 0.20)",
        boxShadow: `0 0 16px ${pinkGlow}, 0 12px 40px rgba(0,0,0,0.65)`,
        animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Pink top accent line */}
      <div className="h-0.5 w-full" style={{ background: pinkGradient }} />

      {/* Header row - category badge + close button */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-2">
        {/* TERTIARY: category badge */}
        <span
          className="font-mono-ui uppercase tracking-[0.14em] px-2 py-0.5 rounded-full shrink-0"
          style={{
            fontSize: "9px",
            background: "rgba(244, 114, 182, 0.18)",
            border: "1px solid rgba(244, 114, 182, 0.35)",
            color: "#F472B6",
          }}
        >
          {info.category}
        </span>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-all duration-150"
          style={{
            background: "rgba(148,163,184,0.08)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#F472B6";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(244,114,182,0.18)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(148,163,184,0.08)";
          }}
        >
          ✕
        </button>
      </div>

      {/* PRIMARY: event title - the visual anchor of this popup */}
      <div className="px-4 pb-3">
        <h3
          className="font-grotesk font-bold text-lg leading-snug"
          style={{ color: "var(--text-display)", textShadow: `0 0 16px ${pinkGlow}` }}
        >
          {info.title}
        </h3>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }} />

      {/* SECONDARY: date/time + venue */}
      <div className="px-4 py-3 flex flex-col gap-1.5">
        {/* Date and time on one line */}
        <p className="font-grotesk text-sm" style={{ color: "var(--text-primary)" }}>
          {info.date} · {info.time}
        </p>
        {/* Venue name below */}
        <p className="font-grotesk text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {info.venue}
        </p>

        {/* TERTIARY: address in mono ALL CAPS */}
        <p
          className="font-mono-ui uppercase tracking-[0.12em]"
          style={{ fontSize: "10px", color: "var(--text-disabled)" }}
        >
          {info.address}
        </p>
      </div>

      {/* "Get Tickets" button - only rendered when ticket_url is present */}
      {info.ticket_url && (
        <>
          <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }} />
          <div className="px-4 py-3">
            <a
              href={info.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 rounded-xl font-grotesk text-sm font-bold text-center transition-all duration-200"
              style={{
                background: pinkGradient,
                color: "#fff",
                border: "1px solid rgba(249, 168, 212, 0.40)",
                boxShadow: `0 0 16px ${pinkGlow}, 0 4px 16px rgba(0,0,0,0.4)`,
                letterSpacing: "0.03em",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                  `0 0 28px ${pinkGlow}, 0 4px 24px rgba(0,0,0,0.5)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                  `0 0 16px ${pinkGlow}, 0 4px 16px rgba(0,0,0,0.4)`;
              }}
            >
              Get Tickets →
            </a>
          </div>
        </>
      )}
      {info.lng !== undefined && info.lat !== undefined && onGetDirections && (
        <>
          <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }} />
          <div className="px-4 py-3">
            <button
              onClick={() => {
                onGetDirections(info.lng!, info.lat!);
              }}
              className="block w-full py-2.5 rounded-xl font-grotesk text-sm font-bold text-center transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
                color: "#fff",
                border: "1px solid rgba(52,211,153,0.40)",
                boxShadow: "0 0 16px rgba(16,185,129,0.45), 0 4px 16px rgba(0,0,0,0.4)",
                letterSpacing: "0.03em",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 28px rgba(16,185,129,0.55), 0 4px 24px rgba(0,0,0,0.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(16,185,129,0.45), 0 4px 16px rgba(0,0,0,0.4)";
              }}
            >
              🌿 Get directions →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
