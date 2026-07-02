// A calm, on-brand stand-in for the 3D core so the socket never collapses to a
// blank circle when WebGL is unavailable, motion is suppressed, or the heavy
// canvas chunk is still loading. Pure presentation — no three.js import.
export default function CoreFallback({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
      <div
        className="h-[86%] w-[86%] rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${color}33, transparent 62%)`,
          boxShadow: `0 0 120px 12px ${color}22`,
        }}
      />
      <div
        className="absolute h-[72%] w-[72%] rounded-full border"
        style={{ borderColor: `${color}55` }}
      />
      <div
        className="absolute h-[42%] w-[42%] rounded-full border border-white/10"
        style={{ boxShadow: `inset 0 0 40px ${color}22` }}
      />
    </div>
  );
}
