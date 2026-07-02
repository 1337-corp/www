"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { hash01 } from "./graphics";
import { useMediaQuery, useReducedMotionSafe, useWebGLSupported } from "./media";
import CoreFallback from "./CoreFallback";
import Schematic from "./Schematic";
import Terminal from "./Terminal";
import { PLATES } from "./shell";

// The 3D core (three.js) is code-split out of the initial bundle. It mounts
// only after hydration (coreEnabled is false on the server), and the
// Suspense fallback keeps CoreFallback in the socket for the whole chunk
// download — the core never collapses to a blank circle.
const VeilCanvas = React.lazy(() => import("./VeilCanvas"));

// =========================================================================
// TYPES & INTERFACES
// =========================================================================
interface LatticeNode {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
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

interface Division {
  id: number;
  name: string;
  codename: string;
  icon: React.ReactNode;
  tagline: string;
  description: string;
  accessLevel: string;
  lore: string;
  metric: string;
  color: string;
}

interface Principle {
  id: number;
  callsign: string;
  role: string;
  quote: string;
}

// =========================================================================
// HAND-DRAWN ICONS (16×16 strokes — no icon library)
// =========================================================================
const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

const IconBolt = () => (
  <svg {...iconProps}>
    <path d="M9 1.5L3.5 9H7.5L7 14.5L12.5 7H8.5L9 1.5Z" />
  </svg>
);
const IconStar = () => (
  <svg {...iconProps}>
    <path d="M8 1.5L9.8 6.2L14.5 8L9.8 9.8L8 14.5L6.2 9.8L1.5 8L6.2 6.2L8 1.5Z" />
  </svg>
);
const IconShield = () => (
  <svg {...iconProps}>
    <path d="M8 1.5L13.5 3.5V7.5C13.5 11 11.2 13.4 8 14.5C4.8 13.4 2.5 11 2.5 7.5V3.5L8 1.5Z" />
  </svg>
);
const IconEye = () => (
  <svg {...iconProps}>
    <path d="M1.5 8C3.2 4.8 5.5 3.2 8 3.2C10.5 3.2 12.8 4.8 14.5 8C12.8 11.2 10.5 12.8 8 12.8C5.5 12.8 3.2 11.2 1.5 8Z" />
    <circle cx="8" cy="8" r="2.2" />
  </svg>
);
const IconTerminal = ({ size = 12, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M2 3.5l4.5 4.5L2 12.5M8.5 12.5H14" />
  </svg>
);

// =========================================================================
// DATA ARCHIVES
// =========================================================================
const divisions: Division[] = [
  {
    id: 1,
    name: "SOFTWARE",
    codename: "PRODUCTS & SYSTEMS",
    icon: <IconBolt />,
    tagline: "Build practical software systems with a bias toward speed, clarity, and control.",
    description:
      "Internal tools, public products, automation, and technical infrastructure designed to reduce friction and create leverage.",
    accessLevel: "PRIMARY OPERATING AREA",
    lore: "1337 Corp. develops software for real operational use: tools that make work faster, systems that make decisions cleaner, and interfaces that make complex processes easier to manage.",
    metric: "Full-stack development • Automation • Internal tools • Product infrastructure",
    color: "#ffaa00",
  },
  {
    id: 2,
    name: "CAPITAL",
    codename: "TRADING & INVESTMENT",
    icon: <IconStar />,
    tagline: "Deploy company capital with discipline, patience, and a research-driven process.",
    description:
      "Proprietary trading and investing using internal capital, supported by research, tooling, and structured risk management.",
    accessLevel: "INTERNAL CAPITAL OPERATIONS",
    lore: "Our capital work is focused on independent research, thoughtful execution, and protecting downside before pursuing upside. We are not a fund, advisor, or promoter; we operate with our own capital and our own standards.",
    metric: "Market research • Risk management • Proprietary trading • Long-term investing",
    color: "#00e5ff",
  },
  {
    id: 3,
    name: "RESEARCH",
    codename: "TECHNICAL EXPLORATION",
    icon: <IconShield />,
    tagline: "Study ideas early, test them carefully, and turn useful findings into working systems.",
    description:
      "Focused research across software, markets, automation, infrastructure, and emerging technical opportunities.",
    accessLevel: "EXPLORATORY WORK",
    lore: "1337 Corp. maintains a research function for evaluating new technologies, market structures, and product ideas before they become public projects. The goal is not hype. The goal is better judgment.",
    metric: "Technical research • Market analysis • Prototypes • Experimental systems",
    color: "#8b7cff",
  },
  {
    id: 4,
    name: "VENTURES",
    codename: "INCUBATION & COMPANY BUILDING",
    icon: <IconEye />,
    tagline: "Develop new projects from early concept to durable operating businesses.",
    description:
      "Venture incubation, product strategy, early-stage company formation, and selective collaboration with aligned operators.",
    accessLevel: "SELECTIVE INCUBATION",
    lore: "Some ideas become tools. Some become products. Some become companies. 1337 Corp. creates room for promising projects to be tested, refined, and built with discipline before they are introduced publicly.",
    metric: "Venture incubation • Product strategy • Early-stage operations • Strategic partnerships",
    color: "#ff2e63",
  },
];

const principles: Principle[] = [
  {
    id: 1,
    callsign: "SIMPLE",
    role: "Decisions over noise",
    quote: "We strip problems down until the next honest move is obvious.",
  },
  {
    id: 2,
    callsign: "DISCIPLINED",
    role: "Risk before upside",
    quote: "We protect downside, move deliberately, and let compounding do what force cannot.",
  },
  {
    id: 3,
    callsign: "AWARE",
    role: "Systems that scale judgment",
    quote: "When a tool can reduce friction, improve judgment, or compound effort, we build it.",
  },
];

/** The engineering title block — the sheet's own metadata. */
const SHEET_META = [
  { label: "DWG NO.", value: "1337-CD" },
  { label: "REV.", value: "2026.07" },
  { label: "SHEET", value: "01 / 01" },
] as const;

// =========================================================================
// COMPONENT: TERMINAL CARET CURSOR
// A block caret — the terminal's own cursor, loose on the page.
// =========================================================================
const CaretCursor: React.FC = () => {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  // Only devices with a real hovering pointer get the custom caret. Touch /
  // coarse-pointer devices keep their native cursor (no dead dot, no hidden
  // pointer). SSR renders nothing, so there is no hydration flash.
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)");

  useEffect(() => {
    if (!fine) return;
    document.documentElement.classList.add("cursor-none");

    const updatePosition = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHovering(
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        !!target.closest("[data-interactive]") ||
        !!target.closest("button, a")
      );
    };

    window.addEventListener("mousemove", updatePosition);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseover", handleMouseOver);

    return () => {
      document.documentElement.classList.remove("cursor-none");
      window.removeEventListener("mousemove", updatePosition);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseover", handleMouseOver);
    };
  }, [fine]);

  if (!fine) return null;

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[99] mix-blend-difference"
      animate={{
        x: position.x - 5,
        y: position.y - 11,
        scaleY: isClicking ? 0.7 : 1,
        scaleX: isHovering ? 1.5 : 1,
        opacity: isHovering ? 1 : 0.85,
      }}
      transition={{ type: "spring", stiffness: 800, damping: 35, mass: 0.2 }}
    >
      <div className="h-[22px] w-[10px] bg-white" />
    </motion.div>
  );
};

// =========================================================================
// COMPONENT: SIGNAL FIELD — one canvas: the node lattice, plus phosphor
// pulses riding its lines. The single ambient system on the page.
// =========================================================================
const SignalField: React.FC<{
  scrollRef: React.RefObject<number>;
  reduced: boolean;
}> = ({ scrollRef, reduced }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false });

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
    let nodes: LatticeNode[] = [];
    let pulses: SignalPulse[] = [];
    let pulseSeed = 1;
    const spacing = 50;
    const PULSE_COUNT = 3;

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
      pulses = Array.from({ length: PULSE_COUNT }, spawnPulse);

      // Setting canvas.width/height cleared the backing store. When reduced,
      // the loop never reschedules, so repaint the single static frame now.
      if (reduced) loop();
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
          });
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const mouse = mouseRef.current;
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      // First contact snaps (no sweep in from offscreen); afterwards the
      // frame loop eases x/y toward the target.
      if (!mouse.active) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    let time = 0;

    const loop = () => {
      time += 0.004;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouse = mouseRef.current;

      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;

      ctx.clearRect(0, 0, w, h);

      // Read cleanly from the shared ref — never a prop, so scrolling never
      // re-renders the parent tree (or this component).
      const currentScroll = scrollRef.current;
      const scrollRotation = currentScroll * Math.PI * 0.12;
      const scrollScale = 1 + currentScroll * 0.25;
      const cos = Math.cos(scrollRotation);
      const sin = Math.sin(scrollRotation);

      /** Base grid coords → screen coords under the scroll transform. */
      const project = (bx: number, by: number): [number, number] => {
        const cx = bx - w / 2;
        const cy = by - h / 2;
        return [w / 2 + (cx * cos - cy * sin) * scrollScale, h / 2 + (cx * sin + cy * cos) * scrollScale];
      };

      nodes.forEach((node) => {
        node.phase += node.speed;
        const driftX = Math.cos(node.phase + time) * 5;
        const driftY = Math.sin(node.phase * 1.3 + time) * 5;

        const [px, py] = project(node.baseX, node.baseY);
        let targetX = px + driftX;
        let targetY = py + driftY;

        if (mouse.active) {
          const dx = mouse.x - targetX;
          const dy = mouse.y - targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 240;

          // dist > 0 guards the dx/dist normalize against a 0/0 = NaN that
          // would permanently corrupt this node.
          if (dist > 0 && dist < maxDist) {
            const force = (maxDist - dist) / maxDist;
            const pull = Math.sin(force * Math.PI - Math.PI / 2) * 40;
            targetX -= (dx / dist) * pull;
            targetY -= (dy / dist) * pull;
          }
        }

        node.x += (targetX - node.x) * 0.1;
        node.y += (targetY - node.y) * 0.1;
      });

      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        ctx.fillStyle = `rgba(255, 255, 255, ${0.06 + Math.sin(n1.phase) * 0.03})`;
        ctx.fillRect(n1.x - 0.75, n1.y - 0.75, 1.5, 1.5);

        for (let j = i + 1; j < i + 5; j++) {
          if (j >= nodes.length) break;
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d < spacing * 1.5) {
            const alpha = (1 - d / (spacing * 1.5)) * 0.08;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }

      // Phosphor pulses — data moving through the lattice. Each rides one
      // base grid line under the same scroll transform as the nodes.
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
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameId);
    };
  }, [reduced, scrollRef]); // scrollRef is a stable ref; reduced re-inits the loop

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 z-0 bg-[#05050a]" />;
};

// =========================================================================
// COMPONENT: GLITCH WORDMARK
// =========================================================================
const GlitchLogo: React.FC = () => {
  const [isGlitching, setIsGlitching] = useState(false);
  const glitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotionSafe();

  const triggerGlitch = () => {
    // The chromatic flash is motion; reduced-motion readers never see it.
    if (reduced) return;
    // Re-triggering restarts the window instead of letting the earlier
    // timer cut the new flash short.
    if (glitchTimer.current) clearTimeout(glitchTimer.current);
    setIsGlitching(true);
    glitchTimer.current = setTimeout(() => setIsGlitching(false), 380);
  };

  useEffect(
    () => () => {
      if (glitchTimer.current) clearTimeout(glitchTimer.current);
    },
    []
  );

  const markClass = "font-mono text-display-xl font-semibold tracking-[-0.06em]";

  return (
    <div
      className="group relative inline-block cursor-pointer select-none text-center"
      onMouseEnter={triggerGlitch}
      onClick={triggerGlitch}
    >
      <div className="relative mx-auto inline-block">
        <div
          className={`${markClass} text-white transition-all duration-75 ${isGlitching ? "opacity-90" : ""}`}
          style={{
            fontFeatureSettings: '"tnum"',
            textShadow: isGlitching
              ? "3px 0 #ff2e63, -3px 0 #00e5ff"
              : "0 0 60px rgba(0, 255, 159, 0.1)",
          }}
        >
          1337
        </div>
        {/* Chromatic-aberration flash — CRT physics, not palette. */}
        {isGlitching && (
          <>
            <div
              className={`${markClass} absolute left-0 top-0 text-[#ff2e63] opacity-80`}
              style={{ transform: "translate(-2px, 1px)", clipPath: "inset(0 0 40% 0)" }}
            >
              1337
            </div>
            <div
              className={`${markClass} absolute left-0 top-0 text-[#00e5ff] opacity-80`}
              style={{ transform: "translate(2px, -1px)", clipPath: "inset(40% 0 0 0)" }}
            >
              1337
            </div>
          </>
        )}
        <div className="absolute -bottom-2 right-1 font-mono text-[11px] font-bold tracking-[7px] text-white/50">
          CORP.
        </div>
      </div>
      <div className="mx-auto mt-6 h-px w-20 bg-[#00ff9f] opacity-40 transition-all duration-500 group-hover:w-32 group-hover:opacity-90" />
    </div>
  );
};

// =========================================================================
// COMPONENT: TYPED PROMPT — the hero's opening keystroke. SSR renders the
// finished line (crawlers and no-JS readers see everything); after
// hydration it re-types once, motion permitting. Decorative: aria-hidden.
// =========================================================================
const TYPED_COMMAND = "cd 1337.cd";

const TypedPrompt: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const [typed, setTyped] = useState(TYPED_COMMAND);

  useEffect(() => {
    if (reduced) return;
    // The first tick clears the SSR-painted line; the rest type it back.
    // All state changes happen inside the timer callback, never in the
    // effect body itself.
    let i = -1;
    const interval = setInterval(() => {
      i++;
      setTyped(TYPED_COMMAND.slice(0, i));
      if (i >= TYPED_COMMAND.length) clearInterval(interval);
    }, 75);
    return () => clearInterval(interval);
  }, [reduced]);

  // If the preference flips to reduced mid-animation, render the whole
  // line — a half-typed command must never freeze on screen.
  const shown = reduced ? TYPED_COMMAND : typed;

  return (
    <div aria-hidden="true" className="font-mono text-xs tracking-wide text-white/50 md:text-sm">
      <span className="text-[#00ff9f]/90">guest@world</span>
      <span className="text-white/40">:~$ </span>
      <span className="text-white/85">{shown}</span>
      <span className="caret-blink ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.18em] bg-[#00ff9f]/80" />
    </div>
  );
};

// =========================================================================
// SCROLL-REVEAL PRIMITIVE — arms after hydration; SSR/no-JS stay visible.
// =========================================================================
const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Seconds; staggers siblings revealed by the same intersection. */
  delay?: number;
}> = ({ children, className, delay = 0 }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver → no choreography: reveal immediately rather
    // than crashing the route or hiding content.
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-in", "");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.setAttribute("data-in", "");
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={className}
      style={delay ? ({ "--reveal-delay": `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
};

// =========================================================================
// COMPONENT: SECTION HEADER — the sheet's chapter rule. Encodes the real
// reading order the terminal's `ls` reports.
// =========================================================================
const SectionHeader: React.FC<{ numeral: string; title: string; index: number }> = ({
  numeral,
  title,
  index,
}) => (
  <Reveal className="mb-14 flex items-end justify-between border-b border-white/10 pb-4">
    <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
      <span aria-hidden="true" className="h-1.5 w-1.5 bg-[#00ff9f]" />
      CH. {numeral} — {title}
    </span>
    <span className="font-mono text-[10px] tracking-[0.3em] text-white/25">
      {String(index).padStart(2, "0")} / {String(PLATES.length).padStart(2, "0")}
    </span>
  </Reveal>
);

// =========================================================================
// MAIN INTEGRATED TRANSCENDENT INTERFACE
// =========================================================================
export default function UltimateCorpExperience() {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  // Starts true so that without IntersectionObserver the core simply keeps
  // rendering; the observer corrects it right after mount everywhere else.
  const [coreInView, setCoreInView] = useState(true);

  const [currentDivIndex, setCurrentDivIndex] = useState(0);
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const vMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<HTMLDivElement | null>(null);
  // Scroll progress drives only the nav progress hairline, the structural
  // guides' brightness, and the background parallax, so it lives in refs
  // (not state): scrolling updates the DOM directly and never re-renders.
  const scrollProgressRef = useRef(0);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const guidesRef = useRef<HTMLDivElement | null>(null);
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);

  const reduced = useReducedMotionSafe();

  // The live 3D core mounts only where WebGL actually works and motion is
  // allowed. SSR/first paint report unsupported, so a static fallback renders
  // and the real core is adopted right after hydration — no blank frame, no
  // hydration mismatch.
  const webglSupported = useWebGLSupported();
  const coreEnabled = webglSupported && !reduced;

  const activeDivision = divisions[currentDivIndex];

  // Arm the reveal system after hydration; without JS (or with reduced
  // motion) nothing is ever hidden.
  useEffect(() => {
    if (reduced) {
      document.documentElement.classList.remove("reveal-armed");
      return;
    }
    document.documentElement.classList.add("reveal-armed");
    return () => document.documentElement.classList.remove("reveal-armed");
  }, [reduced]);

  useEffect(() => {
    let ticking = false;
    const compute = () => {
      ticking = false;
      if (!containerRef.current) return;
      const totalHeight = containerRef.current.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const p = Math.min(Math.max(window.scrollY / totalHeight, 0), 1);
      scrollProgressRef.current = p;
      // Drive the chrome imperatively — no React re-render.
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${p})`;
      }
      if (guidesRef.current) {
        guidesRef.current.style.opacity = String(0.4 + p * 0.6);
      }
    };
    // Coalesce scroll events to at most one update per frame.
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Resize changes both scrollHeight and innerHeight — the progress
    // instruments must not hold a stale fraction until the next scroll.
    window.addEventListener("resize", handleScroll);
    // Seed from the initial/restored scroll position so the chrome and
    // background parallax are correct on reload-while-scrolled or hash landings.
    compute();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Pause the 3D core's render loop whenever it is scrolled out of view.
  useEffect(() => {
    const el = coreRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setCoreInView(entry.isIntersecting),
      { rootMargin: "100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Without IntersectionObserver the nav highlight simply stays put.
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the single most-visible section rather than letting the last
        // entry in the batch win (which could highlight an off-screen section).
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const best = visible.reduce((a, b) =>
          b.intersectionRatio > a.intersectionRatio ? b : a
        );
        setActiveSection(best.target.id);
      },
      { threshold: [0.15, 0.5, 0.85], rootMargin: "-10% 0px -30% 0px" }
    );
    const elements = document.querySelectorAll("section[id]");
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleVeilMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    vMouse.current = { x, y };
  };

  const cycleDivision = (index: number) => {
    setCurrentDivIndex(index);
    setPulseTrigger((prev) => prev + 1);
  };

  const triggerCorePulseDirectly = () => {
    setPulseTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Cmd/Ctrl-K opens the terminal from anywhere, including text fields.
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setTerminalOpen(true);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Never hijack typing: when focus is in an editable element, let the
      // keystroke through (so "/" and "`" work inside the terminal input).
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "`" || e.key === "/") {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, []);

  // The mobile menu closes on Escape, hands focus to its first item on
  // open, and returns focus to its toggle on close (mirroring the
  // terminal's own focus contract).
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const toggle = menuToggleRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      document.getElementById("mobile-menu")?.querySelector<HTMLElement>("button")?.focus();
    }, 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      toggle?.focus({ preventScroll: true });
    };
  }, [mobileMenuOpen]);

  // Explicit behavior:"smooth" overrides the CSS reduced-motion kill-switch,
  // so the preference is honored here in JS as well.
  const navigate = useCallback(
    (target: string): boolean => {
      const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
      if (target === "top") {
        window.scrollTo({ top: 0, behavior });
        return true;
      }
      const el = document.getElementById(target);
      if (!el) return false;
      el.scrollIntoView({ behavior, block: "start" });
      return true;
    },
    [reduced]
  );

  const goTo = (slug: string) => {
    navigate(slug);
    setMobileMenuOpen(false);
  };

  const navItems = PLATES.map((p) => ({
    id: p.slug,
    numeral: p.numeral,
    label: p.slug.toUpperCase(),
  }));

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={containerRef}
        className="relative min-h-dvh overflow-x-clip bg-[#05050a] font-sans text-white selection:bg-[#00ff9f] selection:text-black"
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded focus:bg-white focus:text-black focus:font-mono focus:text-xs focus:tracking-[0.2em]"
        >
          SKIP TO CONTENT
        </a>
        <SignalField scrollRef={scrollProgressRef} reduced={reduced} />
        <CaretCursor />

        {/* STRUCTURAL GUIDES — the drawing sheet's construction lines. */}
        <div
          ref={guidesRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10 hidden md:block"
          style={{ opacity: 0.4 }}
        >
          <div className="absolute left-1/4 top-0 h-full w-px bg-white/[0.04]" />
          <div className="absolute left-2/4 top-0 h-full w-px bg-white/[0.05]" />
          <div className="absolute left-3/4 top-0 h-full w-px bg-white/[0.04]" />
        </div>

        {/* GLOBAL NAVIGATION */}
        <nav
          inert={terminalOpen}
          aria-label="Primary"
          className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#05050a]/70 px-6 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-xl md:px-8"
        >
          <button
            onClick={() => navigate("top")}
            aria-label="Back to top"
            className="group select-none text-left"
          >
            <div className="font-mono text-sm font-black tracking-[0.4em]">1337</div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-white/55 transition-colors group-hover:text-[#00ff9f]">
              THE CORPORATION
            </div>
          </button>

          <div className="hidden items-center gap-8 font-mono text-[10px] tracking-[0.25em] md:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => goTo(item.id)}
                aria-current={activeSection === item.id ? "true" : undefined}
                className={`relative py-1 uppercase transition-all duration-300 ${activeSection === item.id ? "font-bold text-white" : "text-white/55 hover:text-white"
                  }`}
              >
                <span aria-hidden="true" className="mr-1.5 text-white/30">
                  {item.numeral}.
                </span>
                {item.label}
                {activeSection === item.id && (
                  <motion.span
                    layoutId="activeNavLine"
                    className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#00ff9f]"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTerminalOpen(true)}
              className="flex items-center gap-2.5 border border-white/10 bg-white/[0.02] px-5 py-2 font-mono text-[9px] tracking-[0.2em] transition-all hover:border-[#00ff9f]/50 hover:bg-white/5"
            >
              <IconTerminal className="text-[#00ff9f]" /> CMD
            </button>
            <button
              ref={menuToggleRef}
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              className="flex h-9 w-9 items-center justify-center border border-white/10 text-white md:hidden"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                {mobileMenuOpen ? (
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                ) : (
                  <path d="M1 4h12M1 10h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>

          {/* Reading progress — a phosphor hairline under the nav. */}
          <div
            ref={progressBarRef}
            aria-hidden="true"
            className="absolute bottom-[-1px] left-0 h-px w-full origin-left bg-[#00ff9f]/70"
            style={{ transform: "scaleX(0)" }}
          />
        </nav>

        {/* MOBILE NAVIGATION OVERLAY */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              id="mobile-menu"
              role="dialog"
              aria-label="Navigation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              inert={terminalOpen}
              className="fixed inset-0 z-[35] flex flex-col items-center justify-center gap-8 bg-[#05050a]/95 backdrop-blur-xl md:hidden"
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => goTo(item.id)}
                  className={`font-mono text-lg uppercase tracking-[0.3em] transition-colors ${activeSection === item.id ? "text-white" : "text-white/50 hover:text-white"
                    }`}
                >
                  <span aria-hidden="true" className="mr-2 text-white/30">
                    {item.numeral}.
                  </span>
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setTerminalOpen(true);
                }}
                className="mt-4 flex items-center gap-2.5 border border-white/15 px-6 py-3 font-mono text-[11px] tracking-[0.2em]"
              >
                <IconTerminal size={14} className="text-[#00ff9f]" /> OPEN TERMINAL
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CORE FRAME SUBSYSTEM */}
        <main
          id="main-content"
          tabIndex={-1}
          inert={terminalOpen || mobileMenuOpen}
          className="relative z-20 w-full outline-none"
        >
          {/* HERO — the executed command */}
          <section
            id="hero"
            className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-black/40 px-6 pt-16"
          >
            <h1 className="sr-only">1337 Corp — the quiet architects of what comes next.</h1>
            <div className="z-10 space-y-10 text-center">
              <div className="hero-rise" style={{ "--rise-delay": "0.1s" } as React.CSSProperties}>
                <TypedPrompt reduced={reduced} />
              </div>
              <div
                aria-hidden="true"
                className="hero-rise"
                style={{ "--rise-delay": "0.35s" } as React.CSSProperties}
              >
                <GlitchLogo />
              </div>
              <p
                className="hero-rise mx-auto max-w-2xl text-statement font-extralight tracking-tight text-white/85"
                style={{ "--rise-delay": "0.6s" } as React.CSSProperties}
              >
                The quiet architects of what comes{" "}
                <span className="font-normal text-[#00ff9f]">next</span>.
              </p>
            </div>
            <button
              onClick={() => goTo("about")}
              className="absolute bottom-12 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 font-mono text-[9px] tracking-[0.4em] text-white/50 transition-colors hover:text-white"
            >
              [ SCROLL ]
              <span className="mt-1 h-8 w-[1px] bg-gradient-to-b from-white/30 to-transparent" />
            </button>
          </section>

          {/* CHAPTER I: ABOUT */}
          <section
            id="about"
            className="flex min-h-dvh w-full items-center justify-center border-b border-white/5 bg-black/40 px-6 py-28 scroll-mt-24"
          >
            <div className="w-full max-w-6xl">
              <SectionHeader numeral="I" title="Covenant" index={1} />
              <div className="grid gap-14 md:grid-cols-12 md:items-start">
                <Reveal className="md:col-span-7">
                  <h2 className="font-mono text-display font-medium tracking-[-0.04em] text-white">
                    Not a company.
                    <br />
                    <span className="text-white/45">A convergence.</span>
                  </h2>
                </Reveal>
                <div className="space-y-8 md:col-span-5">
                  <Reveal delay={0.12}>
                    <p className="border-l-2 border-[#00ff9f] pl-5 text-lg font-medium leading-relaxed text-white/85">
                      &ldquo;In the beginning there was code. And the code was with the elite, and
                      the code <span className="text-[#00ff9f]">was</span>{" "}elite.&rdquo;
                    </p>
                  </Reveal>
                  <Reveal delay={0.2}>
                    <p className="text-base leading-relaxed text-white/60">
                      A singularity that looked at the limits of what was possible and chose,
                      instead, to rewrite the rules.
                    </p>
                  </Reveal>
                  <Reveal delay={0.28}>
                    <p className="text-base font-medium leading-relaxed text-white/90">
                      We operate where the difference between order and chaos is still something
                      that can be negotiated.
                    </p>
                  </Reveal>
                </div>
              </div>
            </div>
          </section>

          {/* CHAPTER II: ARCHITECTURE (THE SYSTEM SCHEMATIC) */}
          <section
            id="divisions"
            className="flex min-h-dvh w-full items-center justify-center overflow-hidden border-b border-white/5 bg-black/40 px-6 py-28 scroll-mt-24"
          >
            <div className="w-full max-w-6xl">
              <SectionHeader numeral="II" title="Architecture" index={2} />
              <Reveal className="mb-16">
                <h2 className="font-mono text-display font-medium tracking-[-0.04em] text-white">
                  One system.
                  <br />
                  <span className="text-white/45">Four forces.</span>
                </h2>
              </Reveal>

              <div className="grid items-center gap-14 lg:grid-cols-12">
                <Reveal className="lg:col-span-7">
                  <Schematic
                    divisions={divisions}
                    activeIndex={currentDivIndex}
                    onSelect={cycleDivision}
                    core={
                      <div
                        ref={coreRef}
                        onMouseMove={handleVeilMouseMove}
                        onClick={triggerCorePulseDirectly}
                        aria-hidden="true"
                        className="absolute inset-0 cursor-crosshair overflow-hidden rounded-full"
                      >
                        {coreEnabled ? (
                          <Suspense fallback={<CoreFallback color={activeDivision.color} />}>
                            <VeilCanvas
                              mouse={vMouse}
                              pulseTrigger={pulseTrigger}
                              activeColor={activeDivision.color}
                              frameloop={coreInView ? "always" : "never"}
                            />
                          </Suspense>
                        ) : (
                          <CoreFallback color={activeDivision.color} />
                        )}
                      </div>
                    }
                  />
                  <p className="mt-6 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">
                    FIG. 01 — the system{coreEnabled ? " · click the core to echo" : ""}
                  </p>
                </Reveal>

                <div className="lg:col-span-5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeDivision.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="space-y-7"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 items-center justify-center border border-white/10"
                          style={{ color: activeDivision.color }}
                        >
                          {activeDivision.icon}
                        </span>
                        <div>
                          <div className="font-mono text-lg font-bold tracking-[0.14em] text-white">
                            {activeDivision.name}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/45">
                            {activeDivision.codename}
                          </div>
                        </div>
                      </div>

                      <div
                        className="inline-block border px-3 py-1 font-mono text-[9px] font-bold tracking-widest"
                        style={{
                          color: activeDivision.color,
                          borderColor: `${activeDivision.color}55`,
                        }}
                      >
                        {activeDivision.accessLevel}
                      </div>

                      <p className="text-xl font-extralight leading-snug tracking-tight text-white/90 md:text-2xl">
                        {activeDivision.tagline}
                      </p>

                      <p className="text-sm leading-relaxed text-white/65">
                        {activeDivision.description}
                      </p>

                      <p className="border-l border-white/15 pl-4 text-[13px] leading-relaxed text-white/50">
                        {activeDivision.lore}
                      </p>

                      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-5">
                        {activeDivision.metric.split(" • ").map((capability) => (
                          <span
                            key={capability}
                            className="border border-white/10 px-2.5 py-1 font-mono text-[10px] tracking-wide text-white/70"
                          >
                            {capability}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </section>

          {/* CHAPTER III: SPECTRUM */}
          <section
            id="spectrum"
            className="flex min-h-dvh w-full items-center justify-center border-b border-white/5 bg-black/40 px-6 py-28 scroll-mt-24"
          >
            <div className="w-full max-w-6xl">
              <SectionHeader numeral="III" title="Spectrum" index={3} />
              <Reveal className="mb-20">
                <h2 className="font-mono text-display font-medium tracking-[-0.04em] text-white">
                  The vision.
                </h2>
              </Reveal>

              <div>
                {principles.map((principle, i) => (
                  <Reveal key={principle.id} delay={i * 0.12}>
                    <div
                      className={`group grid gap-4 border-t border-white/10 py-10 transition-colors duration-300 hover:bg-white/[0.015] md:grid-cols-12 md:items-baseline md:gap-8 ${i === principles.length - 1 ? "border-b" : ""
                        }`}
                    >
                      <span className="font-mono text-xs tracking-[0.3em] text-white/30 md:col-span-1">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-mono text-3xl font-semibold tracking-[-0.03em] text-white md:col-span-5 md:text-5xl">
                        {principle.callsign}
                        <span className="ml-1 inline-block h-[0.72em] w-[0.4em] bg-[#00ff9f] opacity-0 transition-opacity duration-300 group-hover:opacity-80" />
                      </h3>
                      <div className="space-y-3 md:col-span-6">
                        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/55">
                          {principle.role}
                        </div>
                        <p className="text-lg font-light leading-relaxed text-white/75">
                          {principle.quote}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* CHAPTER IV: CONTACT */}
          <section
            id="contact"
            className="flex min-h-dvh w-full items-center justify-center border-t border-white/5 bg-gradient-to-b from-black/40 to-black/80 px-6 py-28 scroll-mt-24"
          >
            <div className="w-full max-w-6xl">
              <SectionHeader numeral="IV" title="Transmission" index={4} />
              <div className="space-y-12 text-center">
                <Reveal>
                  <h2 className="font-mono text-display font-semibold tracking-[-0.04em] text-white">
                    THE SIGNAL<span className="text-[#00ff9f]">.</span>
                  </h2>
                </Reveal>
                <Reveal delay={0.12}>
                  <p className="mx-auto max-w-xl text-base leading-relaxed text-white/60">
                    For serious inquiries, aligned collaborations, or opportunities that fit the
                    work, use the terminal.
                  </p>
                </Reveal>
                <Reveal delay={0.2}>
                  <div className="space-y-5">
                    <button
                      onClick={() => setTerminalOpen(true)}
                      className="mx-auto flex items-center gap-3 border border-white/20 px-8 py-5 font-mono text-sm transition-all duration-300 hover:border-[#00ff9f]/60 hover:bg-white/[0.03]"
                    >
                      <span className="text-[#00ff9f]">guest@1337:~$</span>
                      <span className="text-white">contact</span>
                      <span
                        aria-hidden="true"
                        className="caret-blink inline-block h-4 w-2 bg-[#00ff9f]/80"
                      />
                    </button>
                    <div className="font-mono text-[9px] tracking-[0.3em] text-white/50">
                      [ / ] TERMINAL&ensp;·&ensp;[ CTRL/⌘ K ] COMMAND
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </section>
        </main>

        {/* THE TITLE BLOCK — an engineering sheet signs itself. */}
        <footer
          inert={terminalOpen || mobileMenuOpen}
          className="relative z-30 border-t border-white/10 bg-[#030307]/80"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-12">
            <div className="space-y-4 md:col-span-5">
              <div>
                <div className="font-mono text-2xl font-black tracking-[0.3em] text-white">1337</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">
                  THE CORPORATION
                </div>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-white/50">
                The quiet architects of what comes next.
              </p>
            </div>

            <nav aria-label="Chapters" className="md:col-span-3">
              <div className="mb-4 font-mono text-[9px] uppercase tracking-[0.3em] text-white/35">
                CHAPTERS
              </div>
              <ul className="space-y-2.5">
                {navItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => goTo(item.id)}
                      className="font-mono text-[11px] tracking-[0.2em] text-white/60 transition-colors hover:text-white"
                    >
                      <span aria-hidden="true" className="mr-2 text-white/30">
                        {item.numeral}.
                      </span>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="md:col-span-2">
              <div className="mb-4 font-mono text-[9px] uppercase tracking-[0.3em] text-white/35">
                SIGNAL
              </div>
              <button
                onClick={() => setTerminalOpen(true)}
                className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-white/60 transition-colors hover:text-white"
              >
                <IconTerminal className="text-[#00ff9f]" /> TERMINAL
              </button>
            </div>

            <dl className="space-y-2.5 border-white/10 md:col-span-2 md:border-l md:pl-6">
              {SHEET_META.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[9px] tracking-[0.2em] text-white/35">{row.label}</dt>
                  <dd className="font-mono text-[10px] tracking-[0.15em] text-white/65">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t border-white/5">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 font-mono text-[9px] tracking-[0.2em] text-white/40">
              <span>© MMXXVI 1337 CORP.</span>
              <span className="text-white/25">1337.CD</span>
            </div>
          </div>
        </footer>

        <Terminal
          isOpen={terminalOpen}
          onClose={() => setTerminalOpen(false)}
          onNavigate={navigate}
        />
      </div>
    </MotionConfig>
  );
}
