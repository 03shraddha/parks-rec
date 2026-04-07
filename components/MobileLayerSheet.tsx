"use client";

import { useState, useEffect } from "react";

interface MobileLayerSheetProps {
  children: React.ReactNode;
  activeLayerCount: number;
}

export default function MobileLayerSheet({ children, activeLayerCount }: MobileLayerSheetProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Desktop: transparent pass-through
  if (!isMobile) return <>{children}</>;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 pointer-events-auto"
      style={{ willChange: "transform" }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid var(--border-subtle)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.40)",
        }}
      >
        {/* Handle / toggle row */}
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex flex-col items-center pt-3 pb-2 gap-1.5"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse layer controls" : "Expand layer controls"}
        >
          {/* Pill handle */}
          <div
            style={{
              width: "36px",
              height: "4px",
              borderRadius: "2px",
              background: "var(--border-subtle)",
            }}
          />
          {/* Label row */}
          <div className="flex items-center gap-2">
            <span
              className="font-mono-ui uppercase tracking-[0.15em]"
              style={{ fontSize: "9px", color: "var(--text-disabled)" }}
            >
              ✦ Layers{activeLayerCount > 0 ? ` · ${activeLayerCount} active` : ""}
            </span>
            {/* Chevron */}
            <svg
              className="w-3 h-3 transition-transform duration-300"
              style={{
                color: "var(--text-disabled)",
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </button>

        {/* Collapsible content */}
        <div
          style={{
            maxHeight: isOpen ? "420px" : "0",
            overflow: "hidden",
            transition: "max-height 0.32s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <div className="px-3 pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
