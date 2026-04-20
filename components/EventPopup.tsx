"use client";

import type { EventInfo } from "./Map";

interface EventPopupProps {
  info: EventInfo;
  onClose: () => void;
  onGetDirections?: (lng: number, lat: number) => void;
}

export default function EventPopup({ info, onClose, onGetDirections }: EventPopupProps) {
  const hasContact = !!(info.organizer || info.contact_phone || info.contact_email);

  return (
    <div
      className="pointer-events-auto w-80 max-w-[calc(100vw-2rem)]"
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.28), 0 16px 48px rgba(0,0,0,0.20)",
        animation: "card-unfurl 0.38s cubic-bezier(0.22,1,0.36,1) both",
        transformOrigin: "top center",
        maxHeight: "calc(100dvh - 8rem)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Thumbnail */}
      {info.thumbnail && (
        <div className="relative w-full overflow-hidden" style={{ maxHeight: "140px", borderRadius: "16px 16px 0 0" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={info.thumbnail}
            alt={info.title}
            className="w-full object-cover"
            style={{ maxHeight: "140px", display: "block" }}
          />
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: "56px",
              background: "linear-gradient(to bottom, transparent, var(--bg-card))",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* Header: category badge + close */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-0">
        <span
          className="font-mono-ui uppercase tracking-[0.16em] shrink-0"
          style={{
            fontSize: "9px",
            background: "rgba(190,24,93,0.07)",
            border: "1px solid rgba(190,24,93,0.22)",
            color: "var(--sakura)",
            borderRadius: "4px",
            padding: "3px 8px",
            marginTop: "2px",
          }}
        >
          {info.category}
        </span>

        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
          style={{
            background: "rgba(148,163,184,0.08)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
            fontSize: "13px",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(190,24,93,0.12)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--sakura)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(148,163,184,0.08)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
        >
          ✕
        </button>
      </div>

      {/* Title */}
      <div className="px-4 pt-2 pb-3">
        <h3
          className="font-zen font-bold leading-tight"
          style={{ fontSize: "21px", color: "var(--text-display)", letterSpacing: "-0.02em" }}
        >
          {info.title}
        </h3>
      </div>

      {/* Ornamental divider */}
      <div className="mx-4 mb-3 flex items-center gap-2">
        <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
        <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "rgba(190,24,93,0.35)" }} />
        <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
      </div>

      {/* Date / venue / address */}
      <div className="px-4 pb-3 flex flex-col gap-1.5">
        <p className="font-grotesk text-sm" style={{ color: "var(--text-primary)" }}>
          {info.date}{info.time ? ` · ${info.time}` : ""}
        </p>
        {info.venue && (
          <p className="font-grotesk text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {info.venue}
          </p>
        )}
        {info.address && (
          <p
            className="font-mono-ui uppercase tracking-[0.12em]"
            style={{ fontSize: "10px", color: "var(--text-disabled)" }}
          >
            {info.address}
          </p>
        )}
      </div>

      {/* Contact info (when extracted) */}
      {hasContact && (
        <>
          <div className="mx-4 mb-2" style={{ height: "1px", background: "var(--border-subtle)" }} />
          <div
            className="mx-4 mb-3 rounded-xl px-3 py-2.5 flex flex-col gap-1"
            style={{ background: "rgba(148,163,184,0.05)", border: "1px solid var(--border-subtle)" }}
          >
            <p className="font-mono-ui uppercase tracking-[0.12em]" style={{ fontSize: "8px", color: "var(--text-disabled)", marginBottom: "2px" }}>
              Contact
            </p>
            {info.organizer && (
              <p className="font-grotesk text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                {info.organizer}
              </p>
            )}
            {info.contact_phone && (
              <a
                href={`tel:${info.contact_phone}`}
                className="font-mono-ui"
                style={{ fontSize: "11px", color: "var(--text-secondary)", textDecoration: "none" }}
              >
                {info.contact_phone}
              </a>
            )}
            {info.contact_email && (
              <a
                href={`mailto:${info.contact_email}`}
                className="font-grotesk text-xs"
                style={{ color: "var(--cyan-light)", textDecoration: "none" }}
              >
                {info.contact_email}
              </a>
            )}
          </div>
        </>
      )}

      {/* Fallback note when no contact extracted but event page exists */}
      {!hasContact && info.more_info_url && (
        <p className="px-4 pb-3 font-grotesk" style={{ fontSize: "11px", color: "var(--text-disabled)" }}>
          Contact info on the event page
        </p>
      )}

      {/* Action buttons */}
      {(info.ticket_url || info.more_info_url || (info.lng !== undefined && info.lat !== undefined && onGetDirections)) && (
        <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
      )}

      {info.ticket_url && (
        <div className="px-4 pt-3 pb-1">
          <a
            href={info.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-2.5 rounded-xl font-grotesk text-sm font-bold text-center transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, #BE185D, #DB2777)",
              color: "#fff",
              border: "1px solid rgba(190,24,93,0.35)",
              boxShadow: "0 2px 12px rgba(190,24,93,0.30)",
              letterSpacing: "0.03em",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 20px rgba(190,24,93,0.45)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 12px rgba(190,24,93,0.30)";
            }}
          >
            Get Tickets
          </a>
        </div>
      )}

      {info.more_info_url && (
        <div className="px-4 pt-2 pb-1">
          <a
            href={info.more_info_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Opens external event page"
            className="block w-full py-2.5 rounded-xl font-grotesk text-sm font-bold text-center transition-all duration-200"
            style={{
              background: "rgba(109,40,217,0.10)",
              color: "var(--violet-light)",
              border: "1px solid var(--border-violet)",
              letterSpacing: "0.03em",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(109,40,217,0.20)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(109,40,217,0.10)";
            }}
          >
            Learn More
          </a>
        </div>
      )}

      {info.lng !== undefined && info.lat !== undefined && onGetDirections && (
        <div className="px-4 pt-2 pb-4">
          <button
            onClick={() => onGetDirections(info.lng!, info.lat!)}
            className="block w-full py-2.5 rounded-xl font-grotesk text-sm font-bold text-center transition-all duration-200"
            style={{
              background: "rgba(4,120,87,0.12)",
              color: "var(--jade-light)",
              border: "1px solid var(--border-jade)",
              letterSpacing: "0.03em",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(4,120,87,0.22)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(4,120,87,0.12)";
            }}
          >
            Get directions
          </button>
        </div>
      )}

      {/* Bottom padding if no buttons */}
      {!info.ticket_url && !info.more_info_url && (info.lng === undefined || info.lat === undefined || !onGetDirections) && (
        <div className="pb-3" />
      )}
    </div>
  );
}
