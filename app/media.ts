"use client";

// SSR-safe client-capability hooks, shared by every component that branches
// on live browser state. All use useSyncExternalStore so the server snapshot
// is the byte-identical "safe" value during hydration, and the real value is
// adopted as a normal post-hydration update — never a hydration mismatch.
//
// This matters most for reduced motion: framer-motion's useReducedMotion
// reads matchMedia during the hydration render itself, which can leave
// server-painted "initial" styles permanently frozen on the page. These
// hooks are the compiled-in guard against that class of bug.

import { useCallback, useSyncExternalStore } from "react";
import { isWebGLAvailable } from "./graphics";

const noopSubscribe = () => () => {};

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Hydration-safe prefers-reduced-motion. Server snapshot is `false`. */
export function useReducedMotionSafe(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function useWebGLSupported(): boolean {
  return useSyncExternalStore(noopSubscribe, isWebGLAvailable, () => false);
}
