"use client";

export default function HeatmapLegend() {
  const tiers = [
    { color: "#FF4500", label: "Scorching", desc: "Little to no tree cover" },
    { color: "#FF8C00", label: "Hot", desc: "Sparse shade" },
    { color: "#FFD700", label: "Warm", desc: "Moderate canopy" },
    { color: "#90EE90", label: "Cool", desc: "Dense tree canopy" },
  ];

  return (
    <div
      className="pointer-events-auto rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255, 200, 0, 0.18)",
        boxShadow: "0 0 12px rgba(255,165,0,0.2), 0 8px 24px rgba(0,0,0,0.5)",
        minWidth: "180px",
      }}
    >
      {/* Amber top accent line */}
      <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #FF4500, #FFD700, #90EE90)" }} />

      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5">
        <p
          className="font-mono-ui uppercase tracking-[0.14em]"
          style={{ fontSize: "9px", color: "var(--text-disabled)" }}
        >
          🌡 Tree Canopy Heat
        </p>
      </div>

      {/* Legend rows */}
      <div className="px-3 pb-3 flex flex-col gap-1.5">
        {tiers.map((tier) => (
          <div key={tier.label} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: tier.color, border: "1px solid rgba(255,255,255,0.15)" }}
            />
            <div>
              <span
                className="font-grotesk text-xs font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {tier.label}
              </span>
              <span
                className="font-grotesk text-xs"
                style={{ color: "var(--text-muted)", marginLeft: "4px" }}
              >
                - {tier.desc}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div
        className="px-3 pb-2.5"
        style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}
      >
        <p
          className="font-mono-ui uppercase tracking-[0.10em] pt-2"
          style={{ fontSize: "8px", color: "var(--text-disabled)" }}
        >
          Click any area for details
        </p>
      </div>
    </div>
  );
}
