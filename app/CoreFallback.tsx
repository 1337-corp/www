import React from "react";

// A calm, on-brand stand-in for the 3D core so the section never collapses to a
// blank frame when WebGL is unavailable, motion is suppressed, or the heavy
// canvas chunk is still loading. Pure presentation — no three.js import.
export default function CoreFallback({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-3xl">
      <div
        className="w-48 h-48 md:w-56 md:h-56 rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${color}33, transparent 62%)`,
          boxShadow: `0 0 120px 12px ${color}22`,
        }}
      />
      <div
        className="absolute w-40 h-40 md:w-48 md:h-48 rounded-full border"
        style={{ borderColor: `${color}55` }}
      />
      <div
        className="absolute w-24 h-24 rounded-full border border-white/10"
        style={{ boxShadow: `inset 0 0 40px ${color}22` }}
      />
    </div>
  );
}
