"use client";

export interface ParkInfo {
  name: string;
  type: string;
  lng: number;
  lat: number;
}

interface ParkPanelProps {
  info: ParkInfo;
  onClose: () => void;
  onRouteHere: (lng: number, lat: number) => void;
}

export default function ParkPanel({ info, onClose, onRouteHere }: ParkPanelProps) {
  return (
    <div
      className="pointer-events-auto rounded-2xl overflow-hidden w-64 max-w-[calc(100vw-2rem)]"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid var(--border-jade)",
        boxShadow: "0 0 16px var(--jade-glow), 0 12px 40px rgba(0,0,0,0.65)",
        animation: "slide-up 0.28s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Green top accent */}
      <div className="h-0.5 w-full" style={{ background: "linear-gradient(135deg, #10B981, #059669)" }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-2">
        <span
          className="font-mono-ui uppercase tracking-[0.14em] px-2 py-0.5 rounded-full shrink-0"
          style={{
            fontSize: "9px",
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(52,211,153,0.35)",
            color: "var(--jade-light)",
          }}
        >
          {info.type || "Park"}
        </span>
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
            (e.currentTarget as HTMLButtonElement).style.color = "var(--jade-light)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.18)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(148,163,184,0.08)";
          }}
        >
          ✕
        </button>
      </div>

      {/* Park name */}
      <div className="px-4 pb-3">
        <h3
          className="font-grotesk font-bold text-lg leading-snug"
          style={{ color: "var(--text-display)", textShadow: "0 0 16px var(--jade-glow)" }}
        >
          {info.name}
        </h3>
      </div>

      <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }} />

      <div className="px-4 py-3">
        <p className="font-grotesk text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          Tap below to get a shaded walking route to this park.
        </p>
        <button
          onClick={() => { onRouteHere(info.lng, info.lat); onClose(); }}
          className="block w-full py-2.5 rounded-xl font-grotesk text-sm font-bold text-center transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, #10B981, #059669)",
            color: "#fff",
            border: "1px solid rgba(52,211,153,0.40)",
            boxShadow: "0 0 16px var(--jade-glow), 0 4px 16px rgba(0,0,0,0.4)",
            letterSpacing: "0.03em",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 28px var(--jade-glow), 0 4px 24px rgba(0,0,0,0.5)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px var(--jade-glow), 0 4px 16px rgba(0,0,0,0.4)";
          }}
        >
          🌿 Route here →
        </button>
      </div>
    </div>
  );
}
