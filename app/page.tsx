"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useMediaQuery, useReducedMotionSafe, useWebGLSupported } from "./media";
import CoreFallback from "./CoreFallback";
import Schematic from "./Schematic";
import SignalField from "./SignalField";
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
          {/* HERO — the field draws the mark. There is no DOM wordmark:
              the signal field's dust condenses into "1337" (then the
              corp's sigils) whenever the halo drifts near the hero's
              centre — the sr-only h1 carries the name for readers and
              crawlers. */}
          <section
            id="hero"
            className="relative flex min-h-dvh w-full flex-col items-center justify-end bg-black/40 px-6 pb-36 pt-16 md:pb-40"
          >
            <h1 className="sr-only">1337 Corp — the quiet architects of what comes next.</h1>
            <div className="z-10 text-center">
              <p
                className="hero-rise mx-auto max-w-2xl text-statement font-extralight tracking-tight text-white/85"
                style={{ "--rise-delay": "0.4s" } as React.CSSProperties}
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
