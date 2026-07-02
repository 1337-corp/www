"use client";

import React from "react";

// =========================================================================
// THE SYSTEM SCHEMATIC — the signature instrument of Chapter II.
//
// An engineering drawing of the corporation: four division nodes wired to
// the central core with Manhattan-routed traces, like a chip pinout. The
// SVG is purely decorative (aria-hidden); the real, keyboard-reachable
// controls are the HTML node buttons layered on top. Geometry lives in ONE
// coordinate system (a 100×100 viewBox over a square container), so the
// HTML nodes and the SVG traces can never drift apart across resizes.
// =========================================================================

export interface SchematicDivision {
  id: number;
  name: string;
  codename: string;
  color: string;
}

/** Node seats and their traces, in viewBox units. Order = division order. */
const SEATS = [
  // top-left → down, then right into the core's upper-left port
  { x: 16, y: 12, trace: "M 16 19 L 16 38 L 33 38", port: [33, 38] as const },
  // top-right → down, then left into the upper-right port
  { x: 84, y: 12, trace: "M 84 19 L 84 38 L 67 38", port: [67, 38] as const },
  // bottom-left → up, then right into the lower-left port
  { x: 16, y: 88, trace: "M 16 81 L 16 62 L 33 62", port: [33, 62] as const },
  // bottom-right → up, then left into the lower-right port
  { x: 84, y: 88, trace: "M 84 81 L 84 62 L 67 62", port: [67, 62] as const },
] as const;

/** Drawing-sheet registration marks in the instrument corners. */
const REGISTRATION_MARKS = [
  [4, 4],
  [96, 4],
  [4, 96],
  [96, 96],
] as const;

export default function Schematic({
  divisions,
  activeIndex,
  onSelect,
  core,
}: {
  divisions: readonly SchematicDivision[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** The wired core visual (3D canvas or fallback); fills the center socket. */
  core: React.ReactNode;
}) {
  // The geometry has exactly four seats. A fifth division is a design
  // decision, not a silent truncation — fail loudly at the source.
  if (divisions.length !== SEATS.length) {
    throw new Error(
      `schematic: ${divisions.length} divisions for ${SEATS.length} seats — extend SEATS geometry first`
    );
  }
  if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= SEATS.length) {
    throw new Error(`schematic: active index ${activeIndex} out of range for ${SEATS.length} seats`);
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px] select-none">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Registration marks — this is a drawing sheet, not a card. */}
        {REGISTRATION_MARKS.map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={`M ${x - 1.4} ${y} H ${x + 1.4} M ${x} ${y - 1.4} V ${y + 1.4}`}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="0.22"
          />
        ))}

        {/* The core ring — the socket the divisions feed. */}
        <circle
          cx="50"
          cy="50"
          r="19"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="0.28"
        />

        {/* Base traces: hairlines, drawn in on first reveal. */}
        {SEATS.map((seat, i) => (
          <path
            key={divisions[i].id}
            d={seat.trace}
            pathLength={1}
            className="trace-base"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="0.28"
          />
        ))}

        {/* The live trace: the active division's signal marching to core. */}
        <path
          d={SEATS[activeIndex].trace}
          fill="none"
          className="trace-live"
          stroke={divisions[activeIndex].color}
          strokeWidth="0.34"
          strokeDasharray="2 1.5"
          opacity="0.9"
        />

        {/* Ports on the core ring; the active port is lit. */}
        {SEATS.map((seat, i) => (
          <circle
            key={divisions[i].id}
            cx={seat.port[0]}
            cy={seat.port[1]}
            r="0.85"
            fill={i === activeIndex ? divisions[i].color : "rgba(255,255,255,0.22)"}
          />
        ))}
      </svg>

      {/* The core socket — the page slots the wired 3D core (or fallback). */}
      <div className="absolute left-1/2 top-1/2 aspect-square w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full">
        {core}
      </div>

      {/* Division node chips — the real controls. */}
      {divisions.map((division, i) => {
        const seat = SEATS[i];
        const active = i === activeIndex;
        return (
          <button
            key={division.id}
            data-interactive
            onClick={() => onSelect(i)}
            aria-pressed={active}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 border px-3 py-2 font-mono transition-colors duration-300 md:px-4 md:py-2.5 ${
              active
                ? "border-white/30 bg-[#05050a]/90 text-white"
                : "border-white/10 bg-[#05050a]/70 text-white/55 hover:border-white/25 hover:text-white/85"
            }`}
            style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
          >
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5"
                style={{
                  backgroundColor: active ? division.color : "rgba(255,255,255,0.18)",
                }}
              />
              <span className="text-[10px] font-bold tracking-[0.22em] md:text-[11px]">
                {division.name}
              </span>
            </span>
            <span className="hidden text-[7.5px] tracking-[0.18em] text-white/40 md:block">
              {division.codename}
            </span>
          </button>
        );
      })}
    </div>
  );
}
