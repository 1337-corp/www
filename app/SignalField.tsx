"use client";

import React, { useEffect, useRef } from "react";
import { hash01 } from "./graphics";

// =========================================================================
// SIGNAL FIELD — the page's single ambient canvas. Five systems share it:
//
//   1. The node lattice — the engineering sheet's living grid.
//   2. Phosphor pulses — data moving through the lattice's lines.
//   3. The speck field — a fine dust of signal points above the grid.
//   4. The halo — a slow, breathing ring that excites whatever it touches.
//   5. The glyph engine — the hero's wordmark, drawn by the dust itself.
//
// The halo is the interaction model. It never snaps to the pointer: it
// *chases* it with heavy inertia, keeps gliding after the hand stops, and
// when no pointer exists (touch devices, idle pages) it wanders the hero
// on its own noise path — the field is alive before it is ever touched.
// Specks the halo crosses ignite from faint white to phosphor, swell,
// stretch into dashes aligned around the ring, and are pushed outward on
// a spring. Their heat charges fast and drains slowly, so a moving cursor
// paints a comet trail that cools over a couple of seconds. Pointer taps
// ping the field with an expanding sonar ring that displaces both specks
// and lattice. On first mount the specks sweep in along a diagonal front
// with a bright crest — a one-time reveal, never repeated on resize.
//
// The glyph engine is the hero itself. There is no DOM wordmark: when the
// halo drifts near the hero's centre, the surrounding dust streams into
// pre-assigned seats sampled from rendered type — "1337" first, then the
// corp's sigils in rotation while the visitor stays close. Each speck
// accelerates as it approaches its seat and ignites phosphor as it locks;
// walk away and the mark dissolves back into dust. Because the halo's
// idle wander orbits the same centre, the mark also assembles on its own
// moments after load — and on touch devices, where no cursor exists.
// =========================================================================

interface LatticeNode {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
  /** 0..1 halo/ripple charge — brightens the node and its lines. */
  heat: number;
}

/** A phosphor signal travelling one lattice line — the grid carrying data. */
interface SignalPulse {
  axis: "h" | "v";
  /** Base-coordinate row (axis h) or column (axis v) the pulse rides. */
  lane: number;
  /** 0..1 travel progress across the viewport. */
  progress: number;
  speed: number;
}

/** One signal point of the dust layer above the lattice. */
interface Speck {
  baseX: number;
  baseY: number;
  /** Base half-size in px. */
  size: number;
  /** Squared random bonus — most specks faint, a scattered few bright. */
  spark: number;
  /** Low-frequency spatial cloud value, fixed at seed time. */
  depth: number;
  phase: number;
  /** Per-speck twinkle rate multiplier. */
  rate: number;
  /** A minority of specks ignite cyan instead of phosphor. */
  cyan: boolean;
  /** 0..1 excitation charge: rises fast near the halo, drains slowly. */
  heat: number;
  /** Springy residual displacement away from the halo/ripples. */
  ox: number;
  oy: number;
  /** Angle to the last excitation source — orients the dash. */
  exAngle: number;
  /** Glyph seat (absolute px), valid when tStamp matches the frame stamp. */
  tx: number;
  ty: number;
  tStamp: number;
  /** 0..1 morph blend: how far this speck belongs to the glyph vs the dust. */
  mw: number;
  /** Current morph position — streams toward the seat while captured. */
  mx: number;
  my: number;
}

/** An expanding sonar ring born from a pointer tap or a glyph morph. */
interface Ripple {
  x: number;
  y: number;
  /** 0..1 lifetime; radius = progress × half the screen diagonal. */
  progress: number;
}

const TAU = Math.PI * 2;

// The hero's rotation: the wordmark leads, then the corp's sigils while
// the visitor stays close. Rendered type, sampled to dust seats.
const GLYPHS = ["1337", "{ }", ">_", "$"] as const;
const GLYPH_FONT_PX = 300;
/** Frames a glyph holds before rotating to the next (~5.5 s). */
const GLYPH_HOLD_FRAMES = 330;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Smooth deterministic 1D value noise in [-1, 1] — the halo's own will.
 * Integer lattice of hashes, smoothstep-interpolated between them.
 */
const drift1D = (t: number, seed: number): number => {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const a = hash01(i * 57.13 + seed);
  const b = hash01((i + 1) * 57.13 + seed);
  return (a + (b - a) * u) * 2 - 1;
};

/**
 * Low-frequency spatial clouds in [0, 1] — three summed plane waves with
 * incommensurate wavelengths, so speck brightness gathers in drifts
 * instead of reading as a uniform screen of dots.
 */
const cloud01 = (x: number, y: number): number =>
  0.5 +
  0.5 *
    (Math.sin(x * 0.0125 + y * 0.0071) * 0.5 +
      Math.sin(x * 0.027 - y * 0.019 + 1.7) * 0.32 +
      Math.sin((x + y) * 0.0094 + 2.3) * 0.18);

// Precomputed white→accent color ramps: per-frame color picks are array
// lookups, never string building (which would churn the GC at ~2k specks
// × 60 fps). Alpha rides ctx.globalAlpha instead.
const RAMP_STEPS = 24;
const buildRamp = (r: number, g: number, b: number): string[] =>
  Array.from({ length: RAMP_STEPS + 1 }, (_, i) => {
    const t = i / RAMP_STEPS;
    const ch = (from: number, to: number) => Math.round(from + (to - from) * t);
    return `rgb(${ch(255, r)}, ${ch(255, g)}, ${ch(255, b)})`;
  });
const PHOSPHOR_RAMP = buildRamp(0, 255, 159);
const CYAN_RAMP = buildRamp(0, 229, 255);
const rampIndex = (heat: number): number =>
  Math.min(RAMP_STEPS, Math.round(Math.min(1, heat) * RAMP_STEPS));

// Intro sweep: diagonal front width (in 0..1 sweep space) and duration.
const INTRO_FRAMES = 160;
const INTRO_BAND = 0.28;

const SignalField: React.FC<{
  scrollRef: React.RefObject<number>;
  reduced: boolean;
}> = ({ scrollRef, reduced }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // Decorative layer only — the page stays readable on the dark ground —
      // but the degradation is logged, never silent.
      console.error("signal field: 2d context unavailable, ambient layer disabled");
      return;
    }

    let animFrameId: number;
    let alive = true;
    let nodes: LatticeNode[] = [];
    let specks: Speck[] = [];
    let pulses: SignalPulse[] = [];
    const ripples: Ripple[] = [];
    let pulseSeed = 1;
    const spacing = 50;
    const PULSE_COUNT = 3;

    // The halo's screen position. Seeded by resize(); every frame it eases
    // toward either the pointer or its own wander path — never teleports.
    const halo = { x: 0, y: 0 };

    // Frames elapsed of the one-time reveal. Deliberately NOT reset by
    // resize(): rotating a phone must not replay the intro.
    let introFrame = reduced ? INTRO_FRAMES : 0;

    // --- GLYPH ENGINE STATE ------------------------------------------------
    // Seat lists per glyph: which speck sits where (seat coords relative to
    // the glyph centre, so scrolling never needs a rebuild).
    let glyphSets: { si: number; rx: number; ry: number }[][] = [];
    let glyphIdx = 0;
    /** Eased 0..1 assembly progress (the "hover" of the morph). */
    let hoverE = 0;
    let wasNear = false;
    let glyphHold = 0;
    /** Per-frame stamp marking which specks are currently seated. */
    let stamp = 1;
    /** Capture radius: dust farther than this from its seat never moves. */
    let gatherR = 320;
    // Type is rasterized into this offscreen buffer and sampled to points.
    // Never in the DOM — the page still runs exactly one visible canvas.
    const sampler = document.createElement("canvas");

    const spawnPulse = (): SignalPulse => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      const axis: "h" | "v" = hash01(pulseSeed * 17.3) > 0.5 ? "h" : "v";
      const laneCount = Math.max(1, Math.floor((axis === "h" ? h : w) / spacing));
      const pulse: SignalPulse = {
        axis,
        lane: Math.floor(hash01(pulseSeed * 31.7) * laneCount) * spacing,
        progress: -hash01(pulseSeed * 7.1) * 0.6,
        speed: 0.0016 + hash01(pulseSeed * 13.9) * 0.0022,
      };
      pulseSeed++;
      return pulse;
    };

    const initNodes = (w: number, h: number) => {
      nodes = [];
      const cols = Math.ceil(w / spacing) + 4;
      const rows = Math.ceil(h / spacing) + 4;

      for (let i = -2; i < cols; i++) {
        for (let j = -2; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;
          nodes.push({
            x,
            y,
            baseX: x,
            baseY: y,
            phase: hash01(i * 131.1 + j * 7.3) * Math.PI * 2,
            speed: 0.008 + hash01(i * 17.7 + j * 41.9) * 0.015,
            heat: 0,
          });
        }
      }
    };

    const makeSpeck = (x: number, y: number, a: number, b: number): Speck => ({
      baseX: x,
      baseY: y,
      size: 0.7 + hash01(a * 3.7 + b * 9.1) * 0.7,
      spark: hash01(a * 21.3 + b * 44.7) ** 2,
      depth: cloud01(x, y),
      phase: hash01(a * 5.9 + b * 31.4) * TAU,
      rate: 0.5 + hash01(a * 71.7 + b * 13.3) * 1.3,
      cyan: hash01(a * 91.4 + b * 53.1) > 0.85,
      heat: 0,
      ox: 0,
      oy: 0,
      exAngle: 0,
      tx: 0,
      ty: 0,
      tStamp: 0,
      mw: 0,
      mx: 0,
      my: 0,
    });

    /** Specks seeded by the viewport grid — glyph dust is appended after. */
    let baseSpeckCount = 0;

    const initSpecks = (w: number, h: number) => {
      specks = [];
      // Jittered stratified grid: blue-noise-ish spread with zero clumping,
      // fully deterministic. Cell size grows on huge screens so the count
      // stays capped (~2400) regardless of viewport area.
      const cell = Math.max(28, Math.sqrt((w * h) / 2400));
      const cols = Math.ceil(w / cell);
      const rows = Math.ceil(h / cell);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = (i + 0.12 + hash01(i * 12.9898 + j * 78.233) * 0.76) * cell;
          const y = (j + 0.12 + hash01(i * 39.425 + j * 11.135) * 0.76) * cell;
          specks.push(makeSpeck(x, y, i, j));
        }
      }
      baseSpeckCount = specks.length;
    };

    /**
     * Rasterize each glyph, sample it into seat points, top the hero region
     * up with extra dust so every seat can be filled, and assign each seat
     * its nearest speck. Idempotent: re-running (resize, font arrival)
     * first drops previously-added dust.
     */
    const buildGlyphs = (w: number, h: number) => {
      glyphSets = [];
      specks.length = baseSpeckCount;
      const g2 = sampler.getContext("2d");
      if (!g2) {
        console.error("signal field: glyph sampler context unavailable, assembly disabled");
        return;
      }

      gatherR = Math.min(Math.min(w, h) * 0.32, 420);
      const mono = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-geist-mono")
        .trim();
      const font = `600 ${GLYPH_FONT_PX}px ${mono ? `${mono},` : ""} ui-monospace, monospace`;
      // Phones get a floor so the mark keeps presence on narrow screens.
      const wordW = Math.min(Math.max(w * 0.66, 320), 860, w * 0.92);
      const gy0 = h * 0.44;
      const SW = 1500;
      const SH = 560;

      // The wordmark spans the hero column; the sigils match its cap
      // height so the rotation never jumps in visual weight.
      let wordH = wordW * 0.28;
      const pts: { rx: number; ry: number }[][] = GLYPHS.map((text, gi) => {
        sampler.width = SW;
        sampler.height = SH;
        g2.font = font;
        g2.textAlign = "center";
        g2.textBaseline = "middle";
        g2.fillStyle = "#fff";
        const met = g2.measureText(text);
        const tw = Math.max(met.width, 1);
        const th = Math.max(
          (met.actualBoundingBoxAscent || GLYPH_FONT_PX * 0.72) +
            (met.actualBoundingBoxDescent || GLYPH_FONT_PX * 0.08),
          1
        );
        const scale = gi === 0 ? wordW / tw : Math.min((wordH * 1.25) / th, wordW / tw);
        if (gi === 0) wordH = th * scale;
        g2.fillText(text, SW / 2, SH / 2);

        // Seat pitch ~5.5–8 px on screen keeps stroke weight consistent
        // across viewport sizes and glyph shapes — wide enough that seated
        // dots stay distinct (a dot matrix), never a solid fill.
        const stepScreen = Math.min(8, Math.max(5.5, wordW / 100));
        const step = Math.max(2, stepScreen / scale);
        const img = g2.getImageData(0, 0, SW, SH).data;
        const out: { rx: number; ry: number }[] = [];
        for (let sy = step / 2; sy < SH; sy += step) {
          for (let sx = step / 2; sx < SW; sx += step) {
            const a = img[((sy | 0) * SW + (sx | 0)) * 4 + 3];
            if (a > 110) {
              const k = out.length;
              out.push({
                rx: (sx - SW / 2) * scale + (hash01(k * 12.7 + gi * 5.3) - 0.5) * 2.4,
                ry: (sy - SH / 2) * scale + (hash01(k * 31.1 + gi * 8.9) - 0.5) * 2.4,
              });
            }
          }
        }
        return out;
      });

      const maxPts = Math.max(...pts.map((p) => p.length));
      if (maxPts === 0) return;

      // Densify the hero band so the largest glyph always finds enough
      // dust nearby. The extras are ordinary specks — indistinguishable
      // until captured.
      const regionW = wordW * 0.85;
      const regionH = Math.max(wordH * 2.4, 260);
      let inRegion = 0;
      for (const s of specks) {
        if (Math.abs(s.baseX - w / 2) < regionW && Math.abs(s.baseY - gy0) < regionH) inRegion++;
      }
      const dustNeed = Math.max(0, Math.ceil(maxPts * 1.35) - inRegion);
      for (let k = 0; k < dustNeed; k++) {
        const x = w / 2 + (hash01(k * 17.31 + 3.7) - 0.5) * 2 * regionW;
        const y = gy0 + (hash01(k * 29.17 + 8.1) - 0.5) * 2 * regionH;
        specks.push(makeSpeck(x, y, k * 1.618, k * 2.71));
      }

      // Nearest-dust seat assignment, visited in hash-shuffled order so
      // neighbouring seats don't drain the same corner of the region.
      const region: number[] = [];
      for (let i = 0; i < specks.length; i++) {
        const s = specks[i];
        if (
          Math.abs(s.baseX - w / 2) < regionW * 1.2 &&
          Math.abs(s.baseY - gy0) < regionH * 1.25
        ) {
          region.push(i);
        }
      }
      const gather2 = gatherR * gatherR;
      glyphSets = pts.map((set, gi) => {
        const used = new Uint8Array(specks.length);
        const order = set
          .map((p, k) => ({ p, r: hash01(k * 7.77 + gi * 13.13) }))
          .sort((a, b) => a.r - b.r)
          .map((o) => o.p);
        const arr: { si: number; rx: number; ry: number }[] = [];
        for (const p of order) {
          const ax = w / 2 + p.rx;
          const ay = gy0 + p.ry;
          let best = -1;
          let bd = gather2;
          for (const si of region) {
            if (used[si]) continue;
            const s = specks[si];
            const dx = s.baseX - ax;
            const dy = s.baseY - ay;
            const d2 = dx * dx + dy * dy;
            if (d2 < bd) {
              bd = d2;
              best = si;
            }
          }
          if (best >= 0) {
            used[best] = 1;
            arr.push({ si: best, rx: p.rx, ry: p.ry });
          }
        }
        return arr;
      });
    };

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Cap DPR at 2 so 3x/4x displays don't quadruple per-frame fill cost.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Canonical hi-DPI setup: the backing store is DPR-scaled for crispness,
      // but the *display* size is pinned to the viewport in CSS pixels.
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      initNodes(w, h);
      initSpecks(w, h);
      buildGlyphs(w, h);
      pulses = Array.from({ length: PULSE_COUNT }, spawnPulse);
      halo.x = w * 0.5;
      halo.y = h * 0.4;

      // Setting canvas.width/height cleared the backing store. When reduced,
      // the loop never reschedules, so repaint the single static frame now.
      if (reduced) loop();
    };

    const handlePointerMove = (e: PointerEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    // A lifted touch has no hover to sustain: hand the halo back to its
    // own wander instead of pinning it to the last touch point forever.
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") mouseRef.current.active = false;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (reduced) return;
      ripples.push({ x: e.clientX, y: e.clientY, progress: 0 });
      if (ripples.length > 4) ripples.shift();
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("mouseleave", handleMouseLeave);

    // The wordmark should be set in the site's real mono face. If the font
    // lands after mount, resample the glyph seats once it does.
    document.fonts?.ready.then(() => {
      if (!alive) return;
      buildGlyphs(window.innerWidth, window.innerHeight);
      if (reduced) loop();
    });

    let time = 0;

    const loop = () => {
      time += 0.004;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, w, h);

      // Read cleanly from the shared ref — never a prop, so scrolling never
      // re-renders the parent tree (or this component).
      const currentScroll = scrollRef.current;
      const scrollRotation = currentScroll * Math.PI * 0.12;
      const scrollScale = 1 + currentScroll * 0.25;
      const cos = Math.cos(scrollRotation);
      const sin = Math.sin(scrollRotation);

      // Past the hero the field settles: excitation and speck brightness
      // wind down (never to zero — a faint life stays) so deep chapters
      // read calm while the lattice keeps its structure.
      const calm = 1 - smoothstep(0.05, 0.32, currentScroll);
      const haloStrength = reduced ? 0 : 0.3 + 0.7 * calm;
      const fieldAlpha = 0.45 + 0.55 * calm;

      // --- THE HALO DRIVER -------------------------------------------------
      // Two-octave value noise gives it a wandering will of its own; the
      // pointer, when present, only re-anchors that wander. The slow lerp is
      // the whole feel: the ring glides in late and keeps drifting after
      // the hand stops.
      const wx = drift1D(time * 1.3, 94.2) * 0.7 + drift1D(time * 3.4, 40.7) * 0.3;
      const wy = drift1D(time * 1.45, 21.0) * 0.7 + drift1D(time * 3.1, 63.2) * 0.3;
      let targetHX: number;
      let targetHY: number;
      let ease: number;
      if (mouse.active) {
        targetHX = mouse.x + wx * 34;
        targetHY = mouse.y + wy * 34;
        ease = 0.045;
      } else {
        targetHX = w * (0.5 + wx * 0.26);
        targetHY = h * (0.4 + wy * 0.22);
        ease = 0.012;
      }
      halo.x += (targetHX - halo.x) * ease;
      halo.y += (targetHY - halo.y) * ease;
      // Breathing radius — two incommensurate sines so it never loops cleanly.
      const R =
        Math.min(w, h) * 0.155 * (1 + 0.1 * Math.sin(time * 4) + 0.06 * Math.cos(time * 9));

      // --- GLYPH DRIVER ------------------------------------------------------
      // The mark is anchored to the page (it scrolls away with the hero),
      // and assembly is gated on the halo's distance — so the trailing,
      // wandering ring is what "reaches" the mark, not the raw pointer.
      const scrollYpx = window.scrollY || 0;
      const gx = w / 2;
      const gy = h * 0.44 - scrollYpx;
      const glyphFade = 1 - smoothstep(h * 0.45, h * 0.95, scrollYpx);
      const seats = glyphSets[glyphIdx];
      let near = false;
      if (seats && seats.length > 0 && glyphFade > 0.02) {
        near = reduced || Math.hypot(halo.x - gx, halo.y - gy) < gatherR * 1.2;
      }
      // Arrival and every rotation fire the same shockwave a tap does —
      // the field announces the morph.
      if (near && !wasNear && !reduced) {
        ripples.push({ x: gx, y: gy, progress: 0 });
        if (ripples.length > 4) ripples.shift();
      }
      wasNear = near;
      hoverE += ((near ? glyphFade : 0) - hoverE) * (reduced ? 1 : 0.05);
      if (hoverE < 0.002) hoverE = 0;
      // The rotation runs only under a live pointer: the halo's own wander
      // assembles the wordmark and holds it — an untouched page (or a
      // phone) always shows the brand, never a mid-rotation sigil. The
      // wordmark also holds twice as long as the sigils that follow it.
      if (!reduced && near && hoverE > 0.9 && mouse.active) {
        glyphHold++;
        if (glyphHold > GLYPH_HOLD_FRAMES * (glyphIdx === 0 ? 2 : 1)) {
          glyphHold = 0;
          glyphIdx = (glyphIdx + 1) % GLYPHS.length;
          ripples.push({ x: gx, y: gy, progress: 0 });
          if (ripples.length > 4) ripples.shift();
        }
      } else if (!near) {
        glyphHold = 0;
        // Once fully dissolved, the rotation resets so the wordmark
        // always leads the next assembly.
        if (hoverE === 0) glyphIdx = 0;
      }
      stamp++;
      if (seats && hoverE > 0.01) {
        for (const seat of seats) {
          const s = specks[seat.si];
          s.tStamp = stamp;
          s.tx = gx + seat.rx;
          s.ty = gy + seat.ry;
        }
      }

      // --- ONE-TIME REVEAL SWEEP -------------------------------------------
      if (!reduced && introFrame < INTRO_FRAMES) introFrame++;
      const ip = introFrame / INTRO_FRAMES;
      // easeInOutQuad: the front hesitates in, rushes the middle, settles out.
      const ie = ip < 0.5 ? 2 * ip * ip : 1 - (-2 * ip + 2) ** 2 / 2;
      const front = ie * (1 + 2 * INTRO_BAND) - INTRO_BAND;
      const introLive = ip < 1;

      /** Base grid coords → screen coords under the scroll transform. */
      const project = (bx: number, by: number): [number, number] => {
        const cx = bx - w / 2;
        const cy = by - h / 2;
        return [w / 2 + (cx * cos - cy * sin) * scrollScale, h / 2 + (cx * sin + cy * cos) * scrollScale];
      };

      const rippleMax = Math.hypot(w, h) * 0.5;

      // --- LATTICE UPDATE ---------------------------------------------------
      nodes.forEach((node) => {
        node.phase += node.speed;
        const driftX = Math.cos(node.phase + time) * 5;
        const driftY = Math.sin(node.phase * 1.3 + time) * 5;

        const [px, py] = project(node.baseX, node.baseY);
        let targetX = px + driftX;
        let targetY = py + driftY;
        let heatT = 0;

        if (haloStrength > 0) {
          const dx = targetX - halo.x;
          const dy = targetY - halo.y;
          const reach = R * 1.5;
          const d2 = dx * dx + dy * dy;
          if (d2 < reach * reach) {
            const d = Math.sqrt(d2) || 0.001;
            // A donut lens: zero displacement at the halo's center and rim,
            // maximum in between — the grid bulges around the ring.
            const bulge = Math.sin((1 - d / reach) * Math.PI) * 24 * haloStrength;
            targetX += (dx / d) * bulge;
            targetY += (dy / d) * bulge;
            heatT =
              (smoothstep(R * 0.6, R * 0.98, d) - smoothstep(R * 0.98, R * 1.3, d)) *
              haloStrength;
          }
        }

        for (const rp of ripples) {
          const rr = rp.progress * rippleMax;
          const dx = targetX - rp.x;
          const dy = targetY - rp.y;
          const d2 = dx * dx + dy * dy;
          const hi = rr + 160;
          const lo = rr - 160;
          if (d2 > hi * hi || (lo > 0 && d2 < lo * lo)) continue;
          const d = Math.sqrt(d2) || 0.001;
          const g = Math.exp(-((d - rr) * (d - rr)) / (2 * 60 * 60)) * (1 - rp.progress);
          targetX += (dx / d) * g * 12;
          targetY += (dy / d) * g * 12;
          if (g > heatT) heatT = g;
        }

        if (heatT > node.heat) node.heat += (heatT - node.heat) * 0.15;
        else node.heat *= 0.94;

        node.x += (targetX - node.x) * 0.1;
        node.y += (targetY - node.y) * 0.1;
      });

      // --- LATTICE DRAW -----------------------------------------------------
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        const nHeat = Math.min(1, n1.heat);
        ctx.globalAlpha = Math.max(0, Math.min(1, 0.06 + Math.sin(n1.phase) * 0.03 + nHeat * 0.3));
        ctx.fillStyle = PHOSPHOR_RAMP[rampIndex(nHeat)];
        const half = 0.75 + nHeat * 0.9;
        ctx.fillRect(n1.x - half, n1.y - half, half * 2, half * 2);

        for (let j = i + 1; j < i + 5; j++) {
          if (j >= nodes.length) break;
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d < spacing * 1.5) {
            const lineHeat = Math.min(1, (n1.heat + n2.heat) * 0.5);
            ctx.globalAlpha = (1 - d / (spacing * 1.5)) * (0.08 + lineHeat * 0.35);
            ctx.strokeStyle = PHOSPHOR_RAMP[rampIndex(lineHeat)];
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }

      // --- PHOSPHOR PULSES — data moving through the lattice. Each rides one
      // base grid line under the same scroll transform as the nodes.
      ctx.globalAlpha = 1;
      const TAIL_STEPS = 7;
      const TAIL_LEN = 90;
      for (const pulse of pulses) {
        const span = (pulse.axis === "h" ? w : h) + spacing * 2;
        const headDist = pulse.progress * span - spacing;

        for (let s = 0; s < TAIL_STEPS; s++) {
          const d0 = headDist - (s / TAIL_STEPS) * TAIL_LEN;
          const d1 = headDist - ((s + 1) / TAIL_STEPS) * TAIL_LEN;
          const alpha = 0.3 * (1 - s / TAIL_STEPS);
          const [x0, y0] =
            pulse.axis === "h" ? project(d0, pulse.lane) : project(pulse.lane, d0);
          const [x1, y1] =
            pulse.axis === "h" ? project(d1, pulse.lane) : project(pulse.lane, d1);
          ctx.strokeStyle = `rgba(0, 255, 159, ${alpha})`;
          ctx.lineWidth = s === 0 ? 1.2 : 0.8;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }

        if (!reduced) {
          pulse.progress += pulse.speed;
          if (pulse.progress > 1.2) {
            const idx = pulses.indexOf(pulse);
            pulses[idx] = spawnPulse();
          }
        }
      }

      // --- SPECK FIELD --------------------------------------------------
      const tw = time * 12;
      for (const s of specks) {
        // Idle drift: two personal wobble octaves plus a traveling wave
        // through screen space — near-still, but never frozen.
        const driftX =
          Math.sin(time * 3.5 + s.phase) * 5 +
          Math.sin(time * 8 + s.phase * 2.7) * 1.6 +
          Math.sin(s.baseY * 0.02 + time * 11) * 2.2;
        const driftY =
          Math.cos(time * 4.1 + s.phase * 1.3) * 5 +
          Math.cos(time * 7.3 + s.phase * 3.1) * 1.6 +
          Math.cos(s.baseX * 0.022 + time * 9) * 2.2;
        const px = s.baseX + driftX;
        const py = s.baseY + driftY;

        // --- Glyph capture: seated specks stream toward their seat,
        // accelerating as they close in; released specks blend back to dust.
        const seated = s.tStamp === stamp && hoverE > 0.01;
        let mwS = 0;
        let lock = 0;
        let travelA = 0;
        let travelD = 0;
        if (seated || s.mw > 0.002) {
          if (seated) {
            // Capture begins from wherever the dust happens to be.
            if (s.mw < 0.002) {
              s.mx = px;
              s.my = py;
            }
            const ddx = s.tx - s.mx;
            const ddy = s.ty - s.my;
            const dd = Math.hypot(ddx, ddy);
            if (reduced) {
              s.mx = s.tx;
              s.my = s.ty;
              s.mw = 1;
            } else {
              const strength = smoothstep(gatherR, gatherR * 0.12, dd);
              const rate = (0.02 + 0.15 * strength) * hoverE;
              s.mx += ddx * rate;
              s.my += ddy * rate;
              s.mw += (hoverE - s.mw) * 0.07;
            }
            lock = 1 - Math.min(1, dd / 70);
            travelA = Math.atan2(ddy, ddx);
            travelD = dd;
          } else {
            s.mw *= 0.93;
          }
          mwS = s.mw * s.mw * (3 - 2 * s.mw);
        }

        // Excitation is measured from the undisplaced position, so the
        // spring can never feed back into its own trigger and oscillate.
        let target = 0;
        let pushX = 0;
        let pushY = 0;

        if (haloStrength > 0) {
          const dx = px - halo.x;
          const dy = py - halo.y;
          const cull = R * 1.75 + 60;
          const d2 = dx * dx + dy * dy;
          if (d2 < cull * cull) {
            const d = Math.sqrt(d2) || 0.001;
            // The rim distance is noise-perturbed so the ring's outer edge
            // frays organically instead of cutting a compass-perfect circle.
            const rim = d + Math.sin(s.phase * 7 + time * 12) * R * 0.05;
            const soft = Math.max(
              0,
              smoothstep(R * 0.5, R * 0.98, d) - smoothstep(R * 0.98, R * 1.5, rim)
            );
            const sharp = Math.max(
              0,
              smoothstep(R * 0.8, R * 0.99, d) - smoothstep(R * 0.99, R * 1.16, rim)
            );
            const inner = 1 - smoothstep(R * 0.3, R * 0.9, d);
            const sparkle = inner * (0.5 + 0.5 * Math.sin(s.phase * 13 + time * 16));
            target =
              (soft * soft * 0.5 + sharp * sharp * 1.5 + inner * 0.3 + sparkle * sparkle * 0.3) *
              haloStrength;
            const push = Math.pow(sharp, 1.4) * 20 * haloStrength;
            pushX = (dx / d) * push;
            pushY = (dy / d) * push;
            if (target > 0.02) s.exAngle = Math.atan2(dy, dx);
          }
        }

        for (const rp of ripples) {
          const rr = rp.progress * rippleMax;
          const dx = px - rp.x;
          const dy = py - rp.y;
          const d2 = dx * dx + dy * dy;
          const hi = rr + 160;
          const lo = rr - 160;
          if (d2 > hi * hi || (lo > 0 && d2 < lo * lo)) continue;
          const d = Math.sqrt(d2) || 0.001;
          const g = Math.exp(-((d - rr) * (d - rr)) / (2 * 60 * 60)) * (1 - rp.progress);
          if (g * 1.1 > target) target = g * 1.1;
          pushX += (dx / d) * g * 16;
          pushY += (dy / d) * g * 16;
          if (g > 0.25) s.exAngle = Math.atan2(dy, dx);
        }

        // Seated specks ignite with the assembly instead of the halo band —
        // and shrug off the shockwaves, or every morph pulse would scatter
        // the mark it announces.
        const morphGlow = mwS * (0.35 + 0.65 * lock);
        if (morphGlow > target) target = morphGlow;
        pushX *= 1 - mwS;
        pushY *= 1 - mwS;

        // Heat charges fast and drains slow — the comet-trail asymmetry.
        if (reduced) s.heat = target;
        else if (target > s.heat) s.heat += (target - s.heat) * 0.16;
        else s.heat *= 0.982;
        if (s.heat < 0.001) s.heat = 0;

        // Springy displacement: eases out toward the push, back when it ends.
        s.ox += (pushX - s.ox) * 0.09;
        s.oy += (pushY - s.oy) * 0.09;
        // Seated specks trade their dust position for their seat; a hair of
        // jitter keeps a locked mark alive rather than frozen.
        const jit = lock > 0.8 && !reduced ? Math.sin(time * 22 + s.phase) * 0.5 : 0;
        const x = (px + s.ox) * (1 - mwS) + s.mx * mwS + jit;
        const y = (py + s.oy) * (1 - mwS) + s.my * mwS + jit;

        // Twinkle: two beating sines, product squared — long faint stretches
        // broken by brief bright activations, different for every speck.
        const beat =
          (0.5 + 0.5 * Math.sin(tw * s.rate + s.phase)) *
          (0.5 + 0.5 * Math.sin(tw * s.rate * 0.53 + s.phase * 2.3 + 1.1));
        const f = beat * beat;

        const heat = Math.min(1, s.heat);
        let alpha =
          (0.05 + 0.3 * s.spark) * (0.5 + 0.5 * s.depth) * (0.55 + 1.1 * f) * fieldAlpha +
          heat * 0.75 +
          mwS * (0.15 + 0.45 * lock);
        let sizeScale = 1;
        let drawHeat = heat;

        if (introLive) {
          // Diagonal front with per-speck jitter; a bright crest travels
          // with it and tints phosphor as it passes.
          const dpos = (px / w + py / h) * 0.5 + (s.phase / TAU - 0.5) * 0.2;
          const dd = front - dpos;
          const rev = smoothstep(0, INTRO_BAND, dd);
          if (rev <= 0.001) continue;
          const crest = Math.exp(-(dd * dd) / (0.115 * 0.115)) * (0.4 + 0.6 * s.spark);
          alpha = (alpha + crest * 0.9) * rev;
          sizeScale = 0.45 + 0.55 * rev;
          if (crest * 0.8 > drawHeat) drawHeat = crest * 0.8;
        }

        // Seated specks converge on a small fixed pixel so the mark reads
        // as a crisp dot matrix; loose dust keeps its heat-swollen size.
        const dustHalf = s.size * (0.78 + 0.5 * s.depth) * (1 + heat * 1.5) * sizeScale;
        const seatHalf = 1.05 + lock * 0.65;
        const half = dustHalf * (1 - mwS) + seatHalf * mwS;
        // The mark is always phosphor — cyan minority specks recolor while
        // seated, or the glyph reads as noise instead of brand.
        const ramp = s.cyan && mwS < 0.3 ? CYAN_RAMP : PHOSPHOR_RAMP;
        if (mwS > 0.3) {
          const seatedHeat = mwS * (0.5 + 0.5 * lock);
          if (seatedHeat > drawHeat) drawHeat = seatedHeat;
        }
        ctx.globalAlpha = Math.min(1, alpha);

        if (!reduced && mwS > 0.15 && travelD > 12) {
          // Streaming to its seat: a motion streak along the travel vector.
          const len = Math.min(14, 3 + travelD * 0.22) * mwS * 0.5;
          const ca = Math.cos(travelA) * len;
          const sa = Math.sin(travelA) * len;
          ctx.strokeStyle = ramp[rampIndex(drawHeat)];
          ctx.lineWidth = Math.max(1, half);
          ctx.beginPath();
          ctx.moveTo(x - ca, y - sa);
          ctx.lineTo(x + ca, y + sa);
          ctx.stroke();
        } else if (heat > 0.45 && mwS < 0.5) {
          // Ring-excited specks stretch into short dashes aligned around
          // their excitation source — the swirl signature of the halo.
          const ang = s.exAngle + Math.PI / 2 + Math.sin(time * 18 + s.phase) * 0.4;
          const len = (2.5 + heat * 5.5) * 0.5;
          const ca = Math.cos(ang) * len;
          const sa = Math.sin(ang) * len;
          ctx.strokeStyle = ramp[rampIndex(drawHeat)];
          ctx.lineWidth = Math.max(1, half);
          ctx.beginPath();
          ctx.moveTo(x - ca, y - sa);
          ctx.lineTo(x + ca, y + sa);
          ctx.stroke();
        } else {
          if (alpha < 0.015) continue;
          ctx.fillStyle = ramp[rampIndex(drawHeat)];
          ctx.fillRect(x - half, y - half, half * 2, half * 2);
        }
      }

      // --- SONAR RINGS — the visible edge of each tap's shockwave.
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        const a = 0.12 * (1 - rp.progress) ** 2;
        if (a >= 0.01) {
          ctx.strokeStyle = `rgba(0, 255, 159, ${a})`;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rp.progress * rippleMax, 0, TAU);
          ctx.stroke();
        }
        rp.progress += 0.009;
        if (rp.progress >= 1) ripples.splice(i, 1);
      }

      // Reduced motion: paint a single static frame and never reschedule.
      if (!reduced) animFrameId = requestAnimationFrame(loop);
    };

    // Size the canvas and seed geometry, then paint. The first paint is
    // deferred one frame so it runs after the page's own mount effects have
    // seeded scrollRef — the reduced-motion single frame then reads the
    // restored scroll position instead of 0.
    resize();
    animFrameId = requestAnimationFrame(loop);

    return () => {
      alive = false;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameId);
    };
  }, [reduced, scrollRef]); // scrollRef is a stable ref; reduced re-inits the loop

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 z-0 bg-[#05050a]" />;
};

export default SignalField;
