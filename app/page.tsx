"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import {
  Terminal as TerminalIcon, Shield, Zap, X, Command, Star, Eye, ChevronRight, Menu
} from "lucide-react";
import CoreFallback from "./CoreFallback";
import { isWebGLAvailable } from "./graphics";

// The 3D core (three.js + drei) is code-split out of the initial bundle. It
// only downloads client-side, and CoreFallback covers the brief load window.
const VeilCanvas = dynamic(() => import("./VeilCanvas"), {
  ssr: false,
  loading: () => null,
});

// =========================================================================
// CLIENT-CAPABILITY HOOKS (SSR-safe via useSyncExternalStore)
// =========================================================================
// These read live browser capabilities without setState-in-effect and without
// hydration drift: the server snapshot is always the "safe" value, and the
// real value is adopted on the client immediately after hydration.
const noopSubscribe = () => () => {};

function useMediaQuery(query: string): boolean {
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

function useWebGLSupported(): boolean {
  return useSyncExternalStore(noopSubscribe, isWebGLAvailable, () => false);
}

// =========================================================================
// TYPES & INTERFACES
// =========================================================================
interface QuantumNode {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: number;
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

interface Operative {
  id: number;
  callsign: string;
  role: string;
  quote: string;
}

interface TerminalLine {
  id: string;
  text: string;
  type: "system" | "input" | "error" | "success" | "header";
}

// Commands the contact terminal recognises (also drives Tab autocomplete).
const TERMINAL_DIRECTIVES = ["contact", "clear", "exit", "help"];

// =========================================================================
// DATA ARCHIVES
// =========================================================================
const divisions: Division[] = [
  {
    id: 1,
    name: "SOFTWARE",
    codename: "PRODUCTS & SYSTEMS",
    icon: <Zap className="w-4 h-4" />,
    tagline: "Build practical software systems with a bias toward speed, clarity, and control.",
    description: "Internal tools, public products, automation, and technical infrastructure designed to reduce friction and create leverage.",
    accessLevel: "PRIMARY OPERATING AREA",
    lore: "1337 Corp. develops software for real operational use: tools that make work faster, systems that make decisions cleaner, and interfaces that make complex processes easier to manage.",
    metric: "Full-stack development • Automation • Internal tools • Product infrastructure",
    color: "#ffaa00"
  },
  {
    id: 2,
    name: "CAPITAL",
    codename: "TRADING & INVESTMENT",
    icon: <Star className="w-4 h-4" />,
    tagline: "Deploy company capital with discipline, patience, and a research-driven process.",
    description: "Proprietary trading and investing using internal capital, supported by research, tooling, and structured risk management.",
    accessLevel: "INTERNAL CAPITAL OPERATIONS",
    lore: "Our capital work is focused on independent research, thoughtful execution, and protecting downside before pursuing upside. We are not a fund, advisor, or promoter; we operate with our own capital and our own standards.",
    metric: "Market research • Risk management • Proprietary trading • Long-term investing",
    color: "#00e5ff"
  },
  {
    id: 3,
    name: "RESEARCH",
    codename: "TECHNICAL EXPLORATION",
    icon: <Shield className="w-4 h-4" />,
    tagline: "Study ideas early, test them carefully, and turn useful findings into working systems.",
    description: "Focused research across software, markets, automation, infrastructure, and emerging technical opportunities.",
    accessLevel: "EXPLORATORY WORK",
    lore: "1337 Corp. maintains a research function for evaluating new technologies, market structures, and product ideas before they become public projects. The goal is not hype. The goal is better judgment.",
    metric: "Technical research • Market analysis • Prototypes • Experimental systems",
    color: "#8b7cff"
  },
  {
    id: 4,
    name: "VENTURES",
    codename: "INCUBATION & COMPANY BUILDING",
    icon: <Eye className="w-4 h-4" />,
    tagline: "Develop new projects from early concept to durable operating businesses.",
    description: "Venture incubation, product strategy, early-stage company formation, and selective collaboration with aligned operators.",
    accessLevel: "SELECTIVE INCUBATION",
    lore: "Some ideas become tools. Some become products. Some become companies. 1337 Corp. creates room for promising projects to be tested, refined, and built with discipline before they are introduced publicly.",
    metric: "Venture incubation • Product strategy • Early-stage operations • Strategic partnerships",
    color: "#ff2e63"
  }
];

const operatives: Operative[] = [
  {
    id: 1,
    callsign: "SIMPLE",
    role: "Decisions over noise",
    quote: "We strip problems down until the next honest move is obvious."
  },
  {
    id: 2,
    callsign: "DISCIPLINED",
    role: "Risk before upside",
    quote: "We protect downside, move deliberately, and let compounding do what force cannot."
  },
  {
    id: 3,
    callsign: "AWARE",
    role: "Systems that scale judgment",
    quote: "When a tool can reduce friction, improve judgment, or compound effort, we build it."
  }
];

// =========================================================================
// COMPONENT: TERMINAL CONTACT MODAL
// =========================================================================
interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TerminalModal: React.FC<TerminalModalProps> = ({ isOpen, onClose }) => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<TerminalLine[]>([
    { id: "h1", text: "1337 CONTACT — INTERFACE", type: "header" },
    { id: "h2", text: "Type 'contact' to show the primary email.", type: "system" },
  ]);
  const [cmdStack, setCmdStack] = useState<string[]>([]);
  const [stackIndex, setStackIndex] = useState(-1);
  const [showContact, setShowContact] = useState(false);
  const [decryptedEmail, setDecryptedEmail] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const bufferEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const CONTACT_EMAIL = "hello@1337.cd";

  const autocompleteSuggestion = useMemo(() => {
    if (!input) return "";
    const clean = input.trim().toLowerCase();
    const match = TERMINAL_DIRECTIVES.find(d => d.startsWith(clean));
    return match && match !== clean ? match.substring(clean.length) : "";
  }, [input]);

  const addLines = (lines: { text: string; type?: TerminalLine["type"] }[]) => {
    setHistory(prev => [
      ...prev,
      ...lines.map(l => ({
        id: Math.random().toString(36).substring(2, 9),
        text: l.text,
        type: l.type || "system"
      }))
    ]);
  };

  const handleExecute = (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    const parts = trimmed.toLowerCase().split(" ");
    const primary = parts[0];

    setCmdStack(prev => [trimmed, ...prev.filter(c => c !== trimmed)]);
    setStackIndex(-1);

    addLines([{ text: `guest@1337:~$ ${trimmed}`, type: "input" }]);

    switch (primary) {
      case "exit":
        onClose();
        break;
      case "clear":
        setHistory([]);
        setShowContact(false);
        break;
      case "help":
        addLines([
          { text: "AVAILABLE COMMANDS:", type: "header" },
          { text: "  contact      — Show primary email" },
          { text: "  clear        — Clear session" },
          { text: "  exit         — Close terminal" }
        ]);
        break;
      case "contact":
        if (!showContact) {
          setShowContact(true);
          addLines([{ text: "Opening contact channel...", type: "system" }]);

          if (scrambleRef.current) clearInterval(scrambleRef.current);
          let i = 0;
          scrambleRef.current = setInterval(() => {
            const scrambled = CONTACT_EMAIL.split("").map((ch, idx) =>
              idx < Math.floor((i / 10) * CONTACT_EMAIL.length) ? ch : String.fromCharCode(33 + Math.floor(Math.random() * 94))
            ).join("");
            setDecryptedEmail(scrambled);
            i++;
            if (i > 10) {
              if (scrambleRef.current) clearInterval(scrambleRef.current);
              scrambleRef.current = null;
              setDecryptedEmail(CONTACT_EMAIL);
            }
          }, 55);
        } else {
          addLines([{ text: "Contact already displayed.", type: "success" }]);
        }
        break;
      default:
        addLines([{ text: `Command not recognized: ${primary}. Type 'help' or 'contact' for options.`, type: "error" }]);
    }
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleExecute(input);
    } else if (e.key === "Tab" && !e.shiftKey) {
      // Forward Tab autocompletes. Shift+Tab is left to the browser/focus-trap
      // so keyboard users can still reach the Close button.
      e.preventDefault();
      if (autocompleteSuggestion) setInput(prev => prev + autocompleteSuggestion);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdStack.length > 0 && stackIndex < cmdStack.length - 1) {
        const next = stackIndex + 1;
        setStackIndex(next);
        setInput(cmdStack[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (stackIndex > 0) {
        const next = stackIndex - 1;
        setStackIndex(next);
        setInput(cmdStack[next]);
      } else if (stackIndex === 0) {
        setStackIndex(-1);
        setInput("");
      }
    }
  };

  // Dialog-level keys: Escape dismisses; Tab is trapped inside the modal.
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    // The command input owns Tab (autocomplete) and preventDefaults it itself,
    // so don't let the trap yank focus off the input on every Tab press.
    if (e.target === inputRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, input, [href], [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (bufferEndRef.current) bufferEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [history, decryptedEmail]);

  // Focus management + teardown: remember the trigger, focus the input on open,
  // stop any running decrypt animation and restore focus on close.
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null;
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    if (scrambleRef.current) {
      clearInterval(scrambleRef.current);
      scrambleRef.current = null;
    }
    triggerRef.current?.focus?.();
  }, [isOpen]);

  // Clear the interval if the component unmounts mid-animation.
  useEffect(() => () => {
    if (scrambleRef.current) clearInterval(scrambleRef.current);
  }, []);

  const getLineStyle = (type: TerminalLine["type"]) => {
    if (type === "header") return "text-white font-semibold tracking-wider";
    if (type === "error") return "text-[#ff2e63]";
    if (type === "success") return "text-[#00e5ff]";
    if (type === "input") return "text-white/40";
    return "text-[#00ff9f]/80";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="terminal-backdrop"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="1337 contact terminal"
          onKeyDown={handleDialogKeyDown}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="w-full max-w-4xl bg-[#030306] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/40 font-mono text-[10px]">
              <div className="flex items-center gap-6">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff2e63]/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffaa00]/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00ff88]/60" />
                </div>
                <div className="text-white/40 tracking-[3px]">TERMINAL</div>
              </div>
              <button onClick={onClose} aria-label="Close terminal" className="flex items-center justify-center w-11 h-11 -my-2 -mr-3 text-white/30 hover:text-white"><X size={14} /></button>
            </div>

            <div className="h-[min(380px,50dvh)] p-6 font-mono text-[11px] overflow-y-auto bg-[#040408]/90 space-y-1.5" onClick={() => inputRef.current?.focus()}>
              {history.map(line => (
                <div key={line.id} className={`whitespace-pre-wrap leading-relaxed tracking-wide ${getLineStyle(line.type)}`}>
                  {line.text}
                </div>
              ))}

              {showContact && (
                <div className="mt-4 p-4 border border-white/5 bg-white/[0.01] rounded-lg">
                  <div className="text-white/30 text-[9px] tracking-widest mb-1">PRIMARY CONTACT</div>
                  <div className="text-lg font-bold tracking-wider text-white select-all">{decryptedEmail}</div>
                </div>
              )}
              <div ref={bufferEndRef} />
            </div>

            <div className="flex items-center border-t border-white/5 bg-black/40 px-5 py-3.5 font-mono text-[11px] relative">
              <span className="text-[#00ff9f] mr-2.5 font-bold">guest@1337:~$</span>
              <div className="flex-1 relative flex items-center">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent outline-none text-white z-10"
                  placeholder="type command..."
                  aria-label="Terminal command input"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {input && autocompleteSuggestion && (
                  <span className="absolute left-0 text-white/20 pointer-events-none">
                    {input}<span className="text-white/30">{autocompleteSuggestion}</span>
                  </span>
                )}
              </div>
              <div className="text-[9px] text-white/20 tracking-widest hidden md:block">[TAB] AUTOCOMPLETE • [↑↓] HISTORY • [ESC] CLOSE</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// =========================================================================
// COMPONENT: CUSTOM INTELLIGENT CURSOR
// =========================================================================
const CustomCursor: React.FC = () => {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  // Only devices with a real hovering pointer get the custom cursor. Touch /
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
        target.closest(".operative-card") !== null
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
    <>
      <motion.div
        className="fixed top-0 left-0 z-[999999] pointer-events-none mix-blend-difference"
        animate={{
          x: position.x - 4,
          y: position.y - 4,
          scale: isClicking ? 0.6 : isHovering ? 1.8 : 1,
        }}
        transition={{ type: "spring", stiffness: 800, damping: 35, mass: 0.2 }}
      >
        <div className="w-2 h-2 bg-white rounded-full" />
      </motion.div>

      <motion.div
        className="fixed top-0 left-0 z-[999998] pointer-events-none border border-white/40 rounded-full mix-blend-difference"
        animate={{
          x: position.x - 20,
          y: position.y - 20,
          scale: isHovering ? 1.4 : 1,
          opacity: isHovering ? 0.6 : 0.3,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ width: 40, height: 40 }}
      />
    </>
  );
};

// =========================================================================
// COMPONENT: LAYERED CANVAS SPACE (QUANTUM FIELD + NEON PARTICLES)
// =========================================================================
const CombinedBackgroundSpace: React.FC<{ scrollRef: React.RefObject<number>; reduced: boolean }> = ({ scrollRef, reduced }) => {
  const quantumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false });
  const particlesRef = useRef<Particle[]>([]);

  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    // Cap the count so the O(n²) connection pass and per-frame draw stay bounded
    // on very large / high-DPI displays instead of scaling with screen area.
    const count = Math.min(Math.floor((width * height) / 22000), 180);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        size: Math.random() * 1.6 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
        hue: Math.random() > 0.75 ? 195 : 340,
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const qCanvas = quantumCanvasRef.current;
    const pCanvas = particleCanvasRef.current;
    if (!qCanvas || !pCanvas) return;

    const qCtx = qCanvas.getContext("2d");
    const pCtx = pCanvas.getContext("2d");
    if (!qCtx || !pCtx) return;

    let animFrameId: number;
    let nodes: QuantumNode[] = [];
    const spacing = 50;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Cap DPR at 2 so 3x/4x displays don't quadruple per-frame fill cost.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Canonical hi-DPI setup: the backing store is DPR-scaled for crispness,
      // but the *display* size is pinned to the viewport in CSS pixels. Without
      // the explicit style size a `fixed inset-0` canvas renders at its
      // attribute size in CSS px, so a DPR-scaled width would overflow to 2x the
      // viewport on retina — drawing coordinates (and the cursor) then desync.
      qCanvas.width = w * dpr;
      qCanvas.height = h * dpr;
      qCanvas.style.width = `${w}px`;
      qCanvas.style.height = `${h}px`;
      qCtx.setTransform(1, 0, 0, 1, 0, 0);
      qCtx.scale(dpr, dpr);

      pCanvas.width = w * dpr;
      pCanvas.height = h * dpr;
      pCanvas.style.width = `${w}px`;
      pCanvas.style.height = `${h}px`;
      pCtx.setTransform(1, 0, 0, 1, 0, 0);
      pCtx.scale(dpr, dpr);

      initNodes(w, h);
      initParticles(w, h);

      // Setting canvas.width/height cleared both backing stores. When reduced,
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
            vx: 0,
            vy: 0,
            phase: Math.random() * Math.PI * 2,
            speed: 0.008 + Math.random() * 0.015,
          });
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
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

      qCtx.clearRect(0, 0, w, h);

      // Read cleanly from the shared ref — never a prop, so scrolling never
      // re-renders the parent tree (or this component).
      const currentScroll = scrollRef.current;
      const scrollRotation = currentScroll * Math.PI * 0.12;
      const scrollScale = 1 + currentScroll * 0.25;

      nodes.forEach((node) => {
        node.phase += node.speed;
        const driftX = Math.cos(node.phase + time) * 5;
        const driftY = Math.sin(node.phase * 1.3 + time) * 5;

        const cx = node.baseX - w / 2;
        const cy = node.baseY - h / 2;

        const rx = cx * Math.cos(scrollRotation) - cy * Math.sin(scrollRotation);
        const ry = cx * Math.sin(scrollRotation) + cy * Math.cos(scrollRotation);

        let targetX = w / 2 + rx * scrollScale + driftX;
        let targetY = h / 2 + ry * scrollScale + driftY;

        if (mouse.active) {
          const dx = mouse.x - targetX;
          const dy = mouse.y - targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 240;

          // dist > 0 guards the dx/dist normalize against a 0/0 = NaN that would
          // permanently corrupt this node (matches the particle loop's guard).
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

      qCtx.strokeStyle = "rgba(255, 255, 255, 0.025)";
      qCtx.lineWidth = 0.5;

      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        qCtx.fillStyle = `rgba(255, 255, 255, ${0.06 + Math.sin(n1.phase) * 0.03})`;
        qCtx.fillRect(n1.x - 0.75, n1.y - 0.75, 1.5, 1.5);

        for (let j = i + 1; j < i + 5; j++) {
          if (j >= nodes.length) break;
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d < spacing * 1.5) {
            const alpha = (1 - d / (spacing * 1.5)) * 0.08;
            qCtx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            qCtx.beginPath();
            qCtx.moveTo(n1.x, n1.y);
            qCtx.lineTo(n2.x, n2.y);
            qCtx.stroke();
          }
        }
      }

      pCtx.fillStyle = "rgba(5, 5, 10, 0.08)";
      pCtx.fillRect(0, 0, w, h);

      const parts = particlesRef.current;
      pCtx.lineWidth = 0.6;

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];

        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 260 && dist > 0) {
            const force = ((260 - dist) / 260) * 0.012;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.vy *= 0.99;

        if (p.x < 0 || p.x > w) p.vx *= -0.6;
        if (p.y < 0 || p.y > h) p.vy *= -0.6;

        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));

        for (let j = i + 1; j < parts.length; j++) {
          const p2 = parts[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 90) {
            pCtx.globalAlpha = (1 - dist / 90) * 0.25 * Math.min(p.alpha, p2.alpha);
            pCtx.strokeStyle = p.hue === 195 ? "rgba(0, 229, 255, 0.12)" : "rgba(255, 46, 99, 0.12)";
            pCtx.beginPath();
            pCtx.moveTo(p.x, p.y);
            pCtx.lineTo(p2.x, p2.y);
            pCtx.stroke();
          }
        }
      }

      for (const p of parts) {
        pCtx.globalAlpha = p.alpha;
        pCtx.fillStyle = p.hue === 195 ? "#00e5ff" : "#ff2e63";
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        pCtx.fill();
      }
      pCtx.globalAlpha = 1;

      // Reduced motion: paint a single static frame and never reschedule.
      if (!reduced) animFrameId = requestAnimationFrame(loop);
    };

    // Size the canvases and seed geometry, then paint. Ordered after loop() is
    // defined so resize()'s reduced-motion repaint has a function to call.
    resize();
    loop();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameId);
    };
  }, [initParticles, reduced, scrollRef]); // scrollRef is a stable ref; reduced re-inits the loop

  return (
    <>
      <canvas ref={particleCanvasRef} aria-hidden="true" className="fixed inset-0 z-0 bg-[#05050a]" />
      <canvas ref={quantumCanvasRef} aria-hidden="true" className="fixed inset-0 z-[1] pointer-events-none mix-blend-screen" />
    </>
  );
};

// =========================================================================
// COMPONENT: GLITCH LOGO ARCHITECTURE
// =========================================================================
const GlitchLogo: React.FC = () => {
  const [isGlitching, setIsGlitching] = useState(false);

  const triggerGlitch = () => {
    setIsGlitching(true);
    setTimeout(() => setIsGlitching(false), 380);
  };

  return (
    <div
      className="relative cursor-pointer select-none group inline-block text-center"
      onMouseEnter={triggerGlitch}
      onClick={triggerGlitch}
    >
      <div className="relative inline-block mx-auto">
        <div
          className={`font-mono text-[96px] md:text-[140px] leading-[0.8] tracking-[-5px] font-black text-white transition-all duration-75 ${isGlitching ? "opacity-90" : ""}`}
          style={{
            fontFeatureSettings: '"tnum"',
            textShadow: isGlitching
              ? "3px 0 #ff2e63, -3px 0 #00e5ff"
              : "0 0 50px rgba(0, 229, 255, 0.12)"
          }}
        >
          1337
        </div>
        {isGlitching && (
          <>
            <div className="absolute top-0 left-0 font-mono text-[96px] md:text-[140px] leading-[0.8] tracking-[-5px] font-black text-[#ff2e63] opacity-80" style={{ transform: "translate(-2px, 1px)", clipPath: "inset(0 0 40% 0)" }}>1337</div>
            <div className="absolute top-0 left-0 font-mono text-[96px] md:text-[140px] leading-[0.8] tracking-[-5px] font-black text-[#00e5ff] opacity-80" style={{ transform: "translate(2px, -1px)", clipPath: "inset(40% 0 0 0)" }}>1337</div>
          </>
        )}
        <div className="absolute -bottom-3 right-1 text-[11px] tracking-[7px] font-bold text-white/50 font-mono">CORP.</div>
      </div>
      <div className="h-[2px] w-20 bg-gradient-to-r from-[#00e5ff] via-white to-[#ff2e63] mx-auto mt-4 opacity-40 group-hover:opacity-100 transition-all duration-500 group-hover:w-32" />
    </div>
  );
};

// =========================================================================
// MAIN INTEGRATED TRANSCENDENT INTERFACE
// =========================================================================
export default function UltimateCorpExperience() {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [coreInView, setCoreInView] = useState(false);

  const [currentDivIndex, setCurrentDivIndex] = useState(0);
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const vMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<HTMLDivElement | null>(null);
  // Scroll progress drives only the frame-overlay opacity, so it lives in refs
  // (not state): scrolling updates the DOM directly and never re-renders the tree.
  const scrollProgressRef = useRef(0);
  const frameOverlayRef = useRef<HTMLDivElement | null>(null);

  const prefersReduced = useReducedMotion();
  const reduced = prefersReduced ?? false;

  // The live 3D core mounts only where WebGL actually works and motion is
  // allowed. SSR/first paint report unsupported, so a static fallback renders
  // and the real core is adopted right after hydration — no blank frame, no
  // hydration mismatch.
  const webglSupported = useWebGLSupported();
  const coreEnabled = webglSupported && !reduced;

  const activeDivision = divisions[currentDivIndex];

  useEffect(() => {
    let ticking = false;
    const compute = () => {
      ticking = false;
      if (!containerRef.current) return;
      const totalHeight = containerRef.current.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const p = Math.min(Math.max(window.scrollY / totalHeight, 0), 1);
      scrollProgressRef.current = p;
      // Drive the frame-overlay opacity imperatively — no React re-render.
      if (frameOverlayRef.current) {
        frameOverlayRef.current.style.opacity = String(0.3 + p * 0.7);
      }
    };
    // Coalesce scroll events to at most one update per frame.
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Seed from the initial/restored scroll position so the overlay opacity and
    // background parallax are correct on reload-while-scrolled or hash landings.
    compute();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Pause the 3D core's render loop whenever it is scrolled out of view.
  useEffect(() => {
    const el = coreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCoreInView(entry.isIntersecting),
      { rootMargin: "100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
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
    setPulseTrigger(prev => prev + 1);
  };

  const triggerCorePulseDirectly = () => {
    setPulseTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Cmd/Ctrl-K opens the terminal from anywhere, including text fields.
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setTerminalOpen(true);
        return;
      }
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

  const navItems = [
    { label: "ABOUT", id: "about" },
    { label: "DIVISIONS", id: "divisions" },
    { label: "SPECTRUM", id: "spectrum" },
    { label: "CONTACT", id: "contact" },
  ];

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) window.scrollTo({ top: target.offsetTop - 90, behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <MotionConfig reducedMotion="user">
    <div ref={containerRef} className="relative min-h-dvh bg-[#05050a] text-white overflow-x-hidden selection:bg-[#00e5ff] selection:text-black font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100000] focus:px-4 focus:py-2 focus:rounded focus:bg-white focus:text-black focus:font-mono focus:text-xs focus:tracking-[0.2em]"
      >
        SKIP TO CONTENT
      </a>
      <CombinedBackgroundSpace scrollRef={scrollProgressRef} reduced={reduced} />
      <CustomCursor />

      <div ref={frameOverlayRef} className="fixed inset-0 pointer-events-none z-50 border-[1px] border-white/5 m-4" style={{ opacity: 0.3 }} />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-gradient-to-b from-white/0 via-white/5 to-white/0 pointer-events-none z-10" />

      {/* GLOBAL NAVIGATION */}
      <nav inert={terminalOpen} className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 md:px-8 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] border-b border-white/5 bg-[#05050a]/60 backdrop-blur-xl mix-blend-difference">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top" className="group select-none text-left">
          <div className="font-mono text-sm tracking-[0.4em] font-black">1337</div>
          <div className="text-[8px] text-white/55 tracking-[0.2em] uppercase transition-colors group-hover:text-[#00e5ff]">THE CORPORATION</div>
        </button>

        <div className="hidden md:flex items-center gap-8 font-mono text-[10px] tracking-[0.25em]">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`transition-all duration-300 relative py-1 uppercase ${activeSection === item.id ? "text-white font-bold" : "text-white/40 hover:text-white"}`}
            >
              {item.label}
              {activeSection === item.id && <motion.span layoutId="activeNavLine" className="absolute bottom-0 left-0 right-0 h-[1px] bg-white" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setTerminalOpen(true)} className="flex items-center gap-2.5 px-5 py-2 rounded-full border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/10 text-[9px] font-mono tracking-[0.2em] transition-all">
            <TerminalIcon size={12} className="text-[#00ff88]" /> CMD
          </button>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-full border border-white/10 text-white"
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </nav>

      {/* MOBILE NAVIGATION OVERLAY */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            inert={terminalOpen}
            className="fixed inset-0 z-[35] md:hidden bg-[#05050a]/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`font-mono text-lg tracking-[0.3em] uppercase transition-colors ${activeSection === item.id ? "text-white" : "text-white/50 hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setMobileMenuOpen(false); setTerminalOpen(true); }}
              className="mt-4 flex items-center gap-2.5 px-6 py-3 rounded-full border border-white/15 text-[11px] font-mono tracking-[0.2em]"
            >
              <TerminalIcon size={14} className="text-[#00ff88]" /> OPEN TERMINAL
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CORE FRAME SUBSYSTEM */}
      <main id="main-content" inert={terminalOpen} className="relative z-20 w-full">

        {/* HERO */}
        <section id="hero" className="min-h-dvh w-full flex flex-col items-center justify-center px-6 relative pt-16 bg-black/40">
          <h1 className="sr-only">1337 Corp — the quiet architects of what comes next.</h1>
          <div className="text-center space-y-8 z-10">
            <div aria-hidden="true"><GlitchLogo /></div>
            <p className="max-w-xl mx-auto font-mono text-xs md:text-sm text-white/50 tracking-wide leading-relaxed">We are the quiet architects of what comes <span className="text-[#ffaa00]">next.</span></p>
          </div>
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[9px] font-mono tracking-[0.4em] text-white/50 animate-pulse">
            DISPLACE DOWN
            <div className="h-8 w-[1px] bg-gradient-to-b from-white/30 to-transparent mt-1" />
          </div>
        </section>

        {/* CHAPTER I: ABOUT */}
        <section id="about" className="min-h-dvh w-full flex items-center justify-center px-6 py-24 relative bg-black/40 border-b border-white/5">
          <div className="max-w-4xl w-full grid md:grid-cols-12 gap-12 items-center relative">
            <div className="md:col-span-5 space-y-4">
              <span className="font-mono text-[10px] tracking-[0.4em] text-[#00e5ff] block uppercase">CHAPTER I // COVENANT</span>
              <h2 className="text-4xl md:text-6xl font-light tracking-tight font-sans leading-none">
                The screen is a <span className="font-serif italic font-normal text-white/80">membrane</span>.
              </h2>
            </div>
            <div className="md:col-span-7 space-y-6 font-mono text-xs md:text-sm text-white/50 leading-relaxed">
              <p className="text-white/80 text-base font-medium font-sans border-l-2 border-[#ff2e63] pl-4">
                &ldquo;In the beginning there was code. And the code was with the elite, and the code <span className="text-[#ff2e63]">was</span>{" "}elite.&rdquo;
              </p>
              <p>Not a company. A convergence. A singularity that looked at the limits of what was possible and chose, instead, to rewrite the rules.</p>
              <p className="text-white/90 font-medium tracking-[-0.2px]">
                We operate where the difference between order and chaos is still something that can be negotiated.
              </p>
            </div>
          </div>
        </section>

        {/* CHAPTER II: ARCHITECTURE (THE VEIL INTEGRATION) */}
        <section id="divisions" className="min-h-dvh w-full flex items-center justify-center px-6 py-24 relative bg-black/40 border-y border-white/5 overflow-hidden">
          <div className="max-w-7xl w-full grid lg:grid-cols-12 gap-12 items-center relative z-10">

            <div className="lg:col-span-4 space-y-8">
              <div>
                <span className="font-mono text-[10px] tracking-[0.4em] text-[#ff2e63] block uppercase mb-2">CHAPTER II // AN ARCHITECTURE</span>
                <h2 className="text-4xl md:text-5xl font-light tracking-tighter text-white font-sans">Force-multiplying.</h2>
              </div>

              <div className="space-y-3">
                {divisions.map((div, index) => {
                  const isSelected = currentDivIndex === index;
                  return (
                    <button
                      key={div.id}
                      data-interactive
                      onClick={() => cycleDivision(index)}
                      className={`w-full text-left p-5 rounded-xl border font-mono transition-all duration-300 flex items-center justify-between ${isSelected
                        ? "bg-white/[0.03] border-white/20 shadow-xl"
                        : "bg-transparent border-white/5 opacity-40 hover:opacity-80"
                        }`}
                      style={{ borderColor: isSelected ? div.color : undefined }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10" style={{ color: div.color }}>
                          {div.icon}
                        </div>
                        <div>
                          <div className="text-white text-sm font-bold tracking-wider">{div.name}</div>
                          <div className="text-[9px] text-white/55 tracking-widest uppercase mt-0.5">{div.codename}</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className={`transition-transform duration-300 ${isSelected ? "rotate-90 text-white" : "text-white/20"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              ref={coreRef}
              className="lg:col-span-4 h-[350px] md:h-[450px] w-full relative cursor-crosshair group rounded-3xl"
              onMouseMove={handleVeilMouseMove}
              onClick={triggerCorePulseDirectly}
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent rounded-3xl pointer-events-none border border-white/5" />
              {coreEnabled ? (
                <VeilCanvas
                  mouse={vMouse}
                  pulseTrigger={pulseTrigger}
                  activeColor={activeDivision.color}
                  frameloop={coreInView ? "always" : "never"}
                />
              ) : (
                <CoreFallback color={activeDivision.color} />
              )}
              {coreEnabled && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[8px] text-white/30 tracking-[3px] uppercase pointer-events-none animate-pulse">
                  Click Core to Echo Pattern
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeDivision.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <div className="inline-block px-3 py-1 rounded bg-white/5 border border-white/10 font-mono text-[9px] tracking-widest font-bold" style={{ color: activeDivision.color }}>
                    {activeDivision.accessLevel}
                  </div>

                  <h3 className="font-serif text-xl md:text-2xl italic text-white/90 leading-snug border-l-2 pl-4" style={{ borderColor: activeDivision.color }}>
                    &ldquo;{activeDivision.tagline}&rdquo;
                  </h3>

                  <p className="font-mono text-xs text-white/60 leading-relaxed bg-white/[0.01] border border-white/5 p-5 rounded-xl">
                    {activeDivision.lore}
                  </p>

                  <div className="pt-4 border-t border-white/5 font-mono text-[10px]">
                    <span className="text-white/80">{activeDivision.metric}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

          </div>
        </section>

        {/* CHAPTER III: SPECTRUM */}
        <section id="spectrum" className="min-h-dvh w-full flex items-center justify-center px-6 py-24 relative bg-black/40 border-b border-white/5">
          <div className="max-w-6xl w-full space-y-16">
            <div className="text-center space-y-3">
              <span className="font-mono text-[10px] tracking-[0.4em] text-[#8b7cff] block uppercase">CHAPTER III // THREE-EYED</span>
              <h2 className="text-4xl md:text-6xl font-light tracking-tight font-sans">The Vision.</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {operatives.map((op) => (
                <div key={op.id} className="operative-card border border-white/5 bg-[#07070c]/40 backdrop-blur-sm p-8 rounded-2xl flex flex-col justify-between space-y-8 hover:border-white/10 transition-all duration-300">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xl font-bold font-sans tracking-tight text-white">{op.callsign}</h4>
                      <p className="text-xs font-mono text-white/40 mt-0.5">{op.role}</p>
                    </div>
                  </div>
                  <p className="font-mono text-xs text-white/70 italic leading-relaxed border-l border-white/20 pl-4">“{op.quote}”</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CHAPTER IV: CONTACT */}
        <section id="contact" className="min-h-dvh w-full flex items-center justify-center px-6 py-24 border-t border-white/5 relative bg-gradient-to-b from-black/40 to-black/80">
          <div className="max-w-3xl w-full text-center space-y-8 relative">
            <div className="space-y-2">
              <span className="font-mono text-[10px] tracking-[0.5em] text-[#c5a26f] block uppercase">CHAPTER IV // TRANSMISSION</span>
              <h2 className="text-5xl md:text-8xl font-black tracking-tight font-sans">THE SIGNAL.</h2>
            </div>
            <p className="font-mono text-xs md:text-sm text-white/50 max-w-xl mx-auto leading-relaxed">For serious inquiries, aligned collaborations, or opportunities that fit the work, use the terminal.</p>
            <div className="pt-4 space-y-4">
              <button onClick={() => setTerminalOpen(true)} className="font-mono text-[11px] tracking-[0.3em] border border-white/20 hover:border-white bg-transparent hover:bg-white hover:text-black px-8 py-4 transition-all duration-500 flex items-center gap-3 mx-auto">
                <Command size={14} /> OPEN CONTACT
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer inert={terminalOpen} className="relative z-30 border-t border-white/5 bg-[#030307]/80 py-8 text-center font-mono text-[9px] tracking-[0.2em] text-white/50">
        <div>2026 • 1337</div>
      </footer>

      <TerminalModal
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
      />
    </div>
    </MotionConfig>
  );
}
