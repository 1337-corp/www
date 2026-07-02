// Pure graphics helpers shared between the page shell and the lazily-loaded
// 3D canvas. Kept dependency-free so importing them never pulls in three.js.

// Deterministic hash in [0, 1). The site's only source of "randomness", so
// anything computed during render stays pure (react-hooks/purity) and stable
// across re-renders and SSR — no hydration drift, no geometry desync.
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Whether a live WebGL context can actually be created on this machine.
// Cached: the answer never changes for the lifetime of the document, and
// creating throwaway contexts is not free.
let webglCache: boolean | null = null;
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement("canvas");
    webglCache = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    webglCache = false;
  }
  return webglCache;
}
