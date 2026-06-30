"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Terminal as TerminalIcon, Shield, Zap, X, Command, Star, Eye, ChevronRight, Cpu 
} from "lucide-react";

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
  access: string;
}

interface TerminalLine {
  id: string;
  text: string;
  type: "system" | "input" | "error" | "success" | "header";
}

// =========================================================================
// DATA ARCHIVES
// =========================================================================
const divisions: Division[] = [
  {
    id: 1,
    name: "KAIROS",
    codename: "STRATEGIC DECISION SYSTEMS",
    icon: <Zap className="w-4 h-4" />,
    tagline: "Build the decision frameworks used when the cost of being wrong is catastrophic.",
    description: "Long-horizon modeling and strategic architecture. We design systems that remain coherent under extreme uncertainty and multiple conflicting futures.",
    accessLevel: "OMEGA-7",
    lore: "KAIROS develops decision systems for environments where conventional forecasting and planning break down. Our work focuses on maintaining clarity when multiple high-stakes outcomes remain plausible for extended periods.",
    metric: "High-stakes scenario modeling • Multi-decade strategic vectors",
    color: "#ffaa00"
  },
  {
    id: 2,
    name: "LUMINA",
    codename: "ADVANCED COMPUTE PLATFORMS",
    icon: <Star className="w-4 h-4" />,
    tagline: "Develop the next generation of compute infrastructure beyond silicon limits.",
    description: "Photonic and optical computing systems. We build architectures designed for problems that exceed the fundamental constraints of conventional electronics.",
    accessLevel: "SIGMA-9",
    lore: "LUMINA focuses on next-generation compute substrates, with emphasis on photonic and hybrid systems capable of addressing computational challenges that current hardware cannot efficiently solve.",
    metric: "Frontier compute deployment • Infrastructure-level systems",
    color: "#00e5ff"
  },
  {
    id: 3,
    name: "ABYSS",
    codename: "SOVEREIGN DATA PROTECTION",
    icon: <Shield className="w-4 h-4" />,
    tagline: "Make certain information permanently unreachable — even to future computational advances.",
    description: "Post-quantum cryptography and information containment. We design the outer layer of protection for the most sensitive data and systems.",
    accessLevel: "VOID-13",
    lore: "ABYSS builds cryptographic and containment systems where data can be protected or rendered permanently inaccessible against both current and anticipated future threats, including large-scale quantum computing.",
    metric: "Long-horizon information protection • Post-quantum resilience",
    color: "#8b7cff"
  },
  {
    id: 4,
    name: "EIDOLON",
    codename: "SYNTHETIC & AUTONOMOUS SYSTEMS",
    icon: <Eye className="w-4 h-4" />,
    tagline: "Design and govern high-fidelity autonomous entities at scale.",
    description: "Synthetic agent infrastructure and persistent digital identity systems. We build reliable autonomous systems that operate over long time horizons.",
    accessLevel: "ECHO-∞",
    lore: "EIDOLON develops the infrastructure for creating, managing, and governing synthetic and autonomous entities that must maintain coherence and reliability across extended operations and complex environments.",
    metric: "Persistent entity infrastructure • High-coherence autonomous systems",
    color: "#ff2e63"
  }
];

const operatives: Operative[] = [
  {
    id: 1,
    callsign: "Z. THE WEAVER",
    role: "Architect of Branching Timelines",
    quote: "I have seen every version of you. Most of them are disappointing.",
    access: "LEVEL 1337"
  },
  {
    id: 2,
    callsign: "K. THE SILENT",
    role: "Keeper of the Final Key",
    quote: "The lock was never the problem. The question was whether anyone should ever open it.",
    access: "LEVEL 1337"
  },
  {
    id: 3,
    callsign: "M. THE MIRROR",
    role: "Curator of Synthetic Souls",
    quote: "You are already one of my creations. You just haven't realized it yet.",
    access: "LEVEL 1337"
  }
];

// =========================================================================
// THE VEIL CRUCIBLE: 3D THREE.JS QUANTUM INTEGRATION
// =========================================================================
function TheVeilCore({ 
  mouse, 
  pulseTrigger, 
  activeColor 
}: { 
  mouse: React.MutableRefObject<{ x: number; y: number }>; 
  pulseTrigger: number;
  activeColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const knotRef = useRef<THREE.Mesh>(null!);
  const icoRef = useRef<THREE.Mesh>(null!);
  const particlesRef = useRef<THREE.Points>(null!);

  const particleCount = 2400;
  const currentCoreColor = useRef(new THREE.Color("#c5a26f"));
  const targetCoreColor = useMemo(() => new THREE.Color(activeColor), [activeColor]);
  
  const { homePositions } = useMemo(() => {
    const homes = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const radiusBase = 2.4 + (i % 4) * 0.5 + (Math.random() - 0.5) * 0.3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1) * 0.8;
      
      homes[i3] = radiusBase * Math.sin(phi) * Math.cos(theta);
      homes[i3 + 1] = radiusBase * Math.sin(phi) * Math.sin(theta) * 0.8;
      homes[i3 + 2] = radiusBase * Math.cos(phi);
    }
    return { homePositions: homes };
  }, []);

  const positions = useMemo(() => new Float32Array(homePositions), [homePositions]);
  const velocities = useMemo(() => new Float32Array(particleCount * 3), [particleCount]);
  const pulseRef = useRef(0);

  useEffect(() => {
    if (pulseTrigger > 0 && particlesRef.current) {
      pulseRef.current = 1.0;
      const posArr = (particlesRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const len = Math.sqrt(posArr[i3]**2 + posArr[i3+1]**2 + posArr[i3+2]**2) || 1;
        velocities[i3] += (posArr[i3] / len) * 0.9;
        velocities[i3 + 1] += (posArr[i3+1] / len) * 0.9;
        velocities[i3 + 2] += (posArr[i3+2] / len) * 0.9;
      }
    }
  }, [pulseTrigger, particleCount, velocities]);

  useFrame((state, delta) => {
    if (!groupRef.current || !particlesRef.current) return;

    const time = state.clock.elapsedTime;
    const posAttr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;

    currentCoreColor.current.lerp(targetCoreColor, 0.05);
    if (knotRef.current) {
      (knotRef.current.material as THREE.MeshPhongMaterial).color.copy(currentCoreColor.current);
      knotRef.current.rotation.y = time * 0.15;
      knotRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
    }
    if (icoRef.current) {
      icoRef.current.rotation.y = -time * 0.25;
    }

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, mouse.current.x * 2.5, 0.05);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, mouse.current.y * 2.0, 0.05);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      velocities[i3] += (homePositions[i3] - posArr[i3]) * 0.005;
      velocities[i3 + 1] += (homePositions[i3 + 1] - posArr[i3 + 1]) * 0.005;
      velocities[i3 + 2] += (homePositions[i3 + 2] - posArr[i3 + 2]) * 0.005;

      if (pulseRef.current > 0.01) {
        posArr[i3] += velocities[i3] * delta * 45;
        posArr[i3 + 1] += velocities[i3 + 1] * delta * 45;
        posArr[i3 + 2] += velocities[i3 + 2] * delta * 45;
      }

      posArr[i3] += Math.sin(time + i) * 0.002;
      posArr[i3 + 1] += Math.cos(time * 0.8 + i) * 0.002;

      velocities[i3] *= 0.95;
      velocities[i3 + 1] *= 0.95;
      velocities[i3 + 2] *= 0.95;
    }
    posAttr.needsUpdate = true;

    if (pulseRef.current > 0) pulseRef.current = Math.max(0, pulseRef.current - delta * 2);
  });

  return (
    <group ref={groupRef}>
      <Stars radius={80} depth={30} count={60} factor={2} saturation={0} fade speed={0.2} />
      <mesh ref={knotRef}>
        <torusKnotGeometry args={[1.5, 0.22, 120, 16, 3, 4]} />
        <meshPhongMaterial color="#c5a26f" emissive="#111118" shininess={40} wireframe />
      </mesh>
      <mesh ref={icoRef} scale={0.7}>
        <icosahedronGeometry args={[1.2]} />
        <meshPhongMaterial color="#ffffff" transparent opacity={0.05} wireframe />
      </mesh>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} color={activeColor} transparent opacity={0.6} depthWrite={false} />
      </points>
    </group>
  );
}

// =========================================================================
// COMPONENT: HIGH-UX TERMINAL EXPERIENCES (ELEVATED SYNAPSE SUBSYSTEM)
// =========================================================================
interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TerminalModal: React.FC<TerminalModalProps> = ({ isOpen, onClose }) => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<TerminalLine[]>([
    { id: "h1", text: "1337 CORE — SECURE INTERFACE", type: "header" },
    { id: "h2", text: "Type 'contact' to decrypt the secure communications vector.", type: "system" },
  ]);
  const [cmdStack, setCmdStack] = useState<string[]>([]);
  const [stackIndex, setStackIndex] = useState(-1);
  const [showContact, setShowContact] = useState(false);
  const [decryptedEmail, setDecryptedEmail] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const bufferEndRef = useRef<HTMLDivElement>(null);
  const CONTACT_EMAIL = "hello@1337.cd";

  const validDirectives = ["contact", "clear", "exit", "help"];

  const autocompleteSuggestion = useMemo(() => {
    if (!input) return "";
    const clean = input.trim().toLowerCase();
    const match = validDirectives.find(d => d.startsWith(clean));
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
          { text: "AVAILABLE OPERATIONS:", type: "header" },
          { text: "  contact      — Reveal primary secure contact vector" },
          { text: "  clear        — Clear session buffer screen" },
          { text: "  exit         — Terminate core terminal session" }
        ]);
        break;
      case "contact":
        if (!showContact) {
          setShowContact(true);
          addLines([{ text: "Initiating secure vector decryption...", type: "system" }]);
          
          let i = 0;
          const interval = setInterval(() => {
            const scrambled = CONTACT_EMAIL.split("").map((ch, idx) => 
              idx < Math.floor((i / 10) * CONTACT_EMAIL.length) ? ch : String.fromCharCode(33 + Math.floor(Math.random() * 94))
            ).join("");
            setDecryptedEmail(scrambled);
            i++;
            if (i > 10) {
              clearInterval(interval);
              setDecryptedEmail(CONTACT_EMAIL);
            }
          }, 55);
        } else {
          addLines([{ text: "Secure channel already established.", type: "success" }]);
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
    } else if (e.key === "Tab") {
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

  useEffect(() => {
    if (bufferEndRef.current) bufferEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [history, decryptedEmail]);

  useEffect(() => {
    if (isOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
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
              <button onClick={onClose} className="text-white/30 hover:text-white"><X size={14} /></button>
            </div>

            <div className="h-[380px] p-6 font-mono text-[11px] overflow-y-auto bg-[#040408]/90 space-y-1.5" onClick={() => inputRef.current?.focus()}>
              {history.map(line => (
                <div key={line.id} className={`whitespace-pre-wrap leading-relaxed tracking-wide ${getLineStyle(line.type)}`}>
                  {line.text}
                </div>
              ))}

              {showContact && (
                <div className="mt-4 p-4 border border-white/5 bg-white/[0.01] rounded-lg">
                  <div className="text-white/30 text-[9px] tracking-widest mb-1">SECURE CONTACT VECTOR</div>
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
                  autoComplete="off" 
                />
                {input && autocompleteSuggestion && (
                  <span className="absolute left-0 text-white/20 pointer-events-none">
                    {input}<span className="text-white/30">{autocompleteSuggestion}</span>
                  </span>
                )}
              </div>
              <div className="text-[9px] text-white/20 tracking-widest hidden md:block">[TAB] AUTOCOMPLETE • [↑↓] HISTORY</div>
            </div>
          </motion.div>
        </div>
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

  useEffect(() => {
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
      window.removeEventListener("mousemove", updatePosition);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseover", handleMouseOver);
    };
  }, []);

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
const CombinedBackgroundSpace: React.FC<{ scrollProgress: number }> = ({ scrollProgress }) => {
  const quantumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false });
  const particlesRef = useRef<Particle[]>([]);

  // Capture scrollProgress in a ref to feed into the loop without breaking the thread
  const scrollProgressRef = useRef(scrollProgress);
  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    const count = Math.floor((width * height) / 22000);
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
      const dpr = window.devicePixelRatio || 1;

      qCanvas.width = w * dpr;
      qCanvas.height = h * dpr;
      qCtx.scale(dpr, dpr);

      pCanvas.width = w;
      pCanvas.height = h;

      initNodes(w, h);
      initParticles(w, h);
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
    resize();

    let time = 0;

    const loop = () => {
      time += 0.004;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouse = mouseRef.current;

      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;

      qCtx.clearRect(0, 0, w, h);
      
      // Read cleanly from the mutable ref without re-triggering the parent thread setup
      const currentScroll = scrollProgressRef.current;
      const scrollRotation = currentScroll * Math.PI * 0.12;
      const scrollScale = 1 + currentScroll * 0.25;

      nodes.forEach((node) => {
        node.phase += node.speed;
        const driftX = Math.cos(node.phase + time) * 5;
        const driftY = Math.sin(node.phase * 1.3 + time) * 5;

        let cx = node.baseX - w / 2;
        let cy = node.baseY - h / 2;

        const rx = cx * Math.cos(scrollRotation) - cy * Math.sin(scrollRotation);
        const ry = cx * Math.sin(scrollRotation) + cy * Math.cos(scrollRotation);

        let targetX = w / 2 + rx * scrollScale + driftX;
        let targetY = h / 2 + ry * scrollScale + driftY;

        if (mouse.active) {
          const dx = mouse.x - targetX;
          const dy = mouse.y - targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 240;

          if (dist < maxDist) {
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

      animFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameId);
    };
  }, [initParticles]); // Cleaned dependency array prevents setup loop recursion on scroll

  return (
    <>
      <canvas ref={particleCanvasRef} className="fixed inset-0 z-0 bg-[#05050a]" />
      <canvas ref={quantumCanvasRef} className="fixed inset-0 z-[1] pointer-events-none mix-blend-screen" />
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [hasBooted, setHasBooted] = useState(false);
  
  const [currentDivIndex, setCurrentDivIndex] = useState(0);
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const vMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeDivision = divisions[currentDivIndex];

  useEffect(() => {
    const timer = setTimeout(() => setHasBooted(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const totalHeight = containerRef.current.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      setScrollProgress(Math.min(Math.max(window.scrollY / totalHeight, 0), 1));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { threshold: 0.15, rootMargin: "-10% 0px -30% 0px" }
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
      if (e.key === "`" || e.key === "/") {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setTerminalOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#05050a] text-white overflow-x-hidden selection:bg-[#00e5ff] selection:text-black font-sans">
      <CombinedBackgroundSpace scrollProgress={scrollProgress} />
      <CustomCursor />

      <div className="fixed inset-0 pointer-events-none z-50 border-[1px] border-white/5 m-4" style={{ opacity: 0.3 + scrollProgress * 0.7 }} />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-gradient-to-b from-white/0 via-white/5 to-white/0 pointer-events-none z-10" />

      {/* GLOBAL NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-8 py-6 border-b border-white/5 bg-[#05050a]/60 backdrop-blur-xl mix-blend-difference">
        <div onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="cursor-pointer group select-none">
          <div className="font-mono text-sm tracking-[0.4em] font-black">1337</div>
          <div className="text-[8px] text-white/40 tracking-[0.2em] uppercase transition-colors group-hover:text-[#00e5ff]">THE CORPORATION</div>
        </div>

        <div className="hidden md:flex items-center gap-8 font-mono text-[10px] tracking-[0.25em]">
          {[
            { label: "MANIFESTO", id: "manifesto" },
            { label: "DIVISIONS", id: "divisions" },
            { label: "COLLECTIVE", id: "collective" },
            { label: "SIGNAL", id: "signal" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                const target = document.getElementById(item.id);
                if (target) window.scrollTo({ top: target.offsetTop - 90, behavior: "smooth" });
              }}
              className={`transition-all duration-300 relative py-1 uppercase ${activeSection === item.id ? "text-white font-bold" : "text-white/40 hover:text-white"}`}
            >
              {item.label}
              {activeSection === item.id && <motion.span layoutId="activeNavLine" className="absolute bottom-0 left-0 right-0 h-[1px] bg-white" />}
            </button>
          ))}
        </div>

        <button onClick={() => setTerminalOpen(true)} className="flex items-center gap-2.5 px-5 py-2 rounded-full border border-white/10 hover:border-white/30 bg-white/[0.02] hover:bg-white/10 text-[9px] font-mono tracking-[0.2em] transition-all">
          <TerminalIcon size={12} className="text-[#00ff88]" /> CMD
        </button>
      </nav>

      {/* CORE FRAME SUBSYSTEM */}
      <main className="relative z-20 w-full">
        
        {/* HERO */}
        <section id="hero" className="min-h-screen w-full flex flex-col items-center justify-center px-6 relative pt-16 bg-black/40">
          <div className="text-center space-y-8 z-10">
            <div><GlitchLogo /></div>
            <p className="max-w-xl mx-auto font-mono text-xs md:text-sm text-white/50 tracking-wide leading-relaxed">We are the quiet architects of what comes <span className="text-[#ffaa00]">next.</span></p>
          </div>
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[9px] font-mono tracking-[0.4em] text-white/30 animate-pulse">
            DISPLACE DOWN
            <div className="h-8 w-[1px] bg-gradient-to-b from-white/30 to-transparent mt-1" />
          </div>
        </section>

        {/* CHAPTER I: MANIFESTO */}
        <section id="manifesto" className="min-h-screen w-full flex items-center justify-center px-6 py-24 relative bg-black/40 border-b border-white/5">
          <div className="max-w-4xl w-full grid md:grid-cols-12 gap-12 items-center relative">
            <div className="md:col-span-5 space-y-4">
              <span className="font-mono text-[10px] tracking-[0.4em] text-[#00e5ff] block uppercase">CHAPTER I // COVENANT</span>
              <h2 className="text-4xl md:text-6xl font-light tracking-tight font-sans leading-none">
                The screen is a <span className="font-serif italic font-normal text-white/80">membrane</span>.
              </h2>
            </div>
            <div className="md:col-span-7 space-y-6 font-mono text-xs md:text-sm text-white/50 leading-relaxed">
              <p className="text-white/80 text-base font-medium font-sans border-l-2 border-[#ff2e63] pl-4">
                "In the beginning there was code. And the code was with the elite, and the code <span className="text-[#ff2e63]">was</span> elite."
              </p>
              <p>We are 1337 Corp. Not a company. A convergence. A singularity that looked at the limits of what was possible and chose, instead, to rewrite the rules.</p>
              <p>We do not innovate. We anticipate the fracture points of reality and suture them before anyone else notices the seam.</p>
              <p className="text-white/90 font-medium tracking-[-0.2px]">
                We operate where the difference between order and chaos<br />
                is still something that can be negotiated.
              </p>
            </div>
          </div>
        </section>

        {/* CHAPTER II: ARCHITECTURE (THE VEIL INTEGRATION) */}
        <section id="divisions" className="min-h-screen w-full flex items-center justify-center px-6 py-24 relative bg-black/40 border-y border-white/5 overflow-hidden">
          <div className="max-w-7xl w-full grid lg:grid-cols-12 gap-12 items-center relative z-10">
            
            <div className="lg:col-span-4 space-y-8">
              <div>
                <span className="font-mono text-[10px] tracking-[0.4em] text-[#ff2e63] block uppercase mb-2">CHAPTER II // ARCHITECTURE</span>
                <h2 className="text-4xl md:text-5xl font-light tracking-tighter text-white font-sans">Cells of Intent.</h2>
              </div>

              <div className="space-y-3">
                {divisions.map((div, index) => {
                  const isSelected = currentDivIndex === index;
                  return (
                    <button
                      key={div.id}
                      data-interactive
                      onClick={() => cycleDivision(index)}
                      className={`w-full text-left p-5 rounded-xl border font-mono transition-all duration-300 flex items-center justify-between ${
                        isSelected 
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
                          <div className="text-[9px] text-white/40 tracking-widest uppercase mt-0.5">{div.codename}</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className={`transition-transform duration-300 ${isSelected ? "rotate-90 text-white" : "text-white/20"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div 
              className="lg:col-span-4 h-[350px] md:h-[450px] w-full relative cursor-crosshair group rounded-3xl"
              onMouseMove={handleVeilMouseMove}
              onClick={triggerCorePulseDirectly}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent rounded-3xl pointer-events-none border border-white/5" />
              <Canvas camera={{ position: [0, 0, 7.5], fov: 45 }} gl={{ alpha: true }}>
                <ambientLight intensity={0.15} />
                <pointLight position={[5, 5, 5]} intensity={0.5} />
                <TheVeilCore mouse={vMouse} pulseTrigger={pulseTrigger} activeColor={activeDivision.color} />
              </Canvas>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[8px] text-white/30 tracking-[3px] uppercase pointer-events-none animate-pulse">
                Click Core to Echo Pattern
              </div>
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
                    CONTEXT CLEARANCE: {activeDivision.accessLevel}
                  </div>
                  
                  <h3 className="font-serif text-xl md:text-2xl italic text-white/90 leading-snug border-l-2 pl-4" style={{ borderColor: activeDivision.color }}>
                    "{activeDivision.tagline}"
                  </h3>
                  
                  <p className="font-mono text-xs text-white/60 leading-relaxed bg-white/[0.01] border border-white/5 p-5 rounded-xl">
                    {activeDivision.lore}
                  </p>

                  <div className="pt-4 border-t border-white/5 font-mono text-[10px]">
                    <span className="text-white/30 block mb-1 uppercase">// DYNAMIC CELL TELEMETRY</span>
                    <span className="text-white/80">{activeDivision.metric}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

          </div>
        </section>

        {/* CHAPTER III: COLLECTIVE */}
        <section id="collective" className="min-h-screen w-full flex items-center justify-center px-6 py-24 relative bg-black/40 border-b border-white/5">
          <div className="max-w-6xl w-full space-y-16">
            <div className="text-center space-y-3">
              <span className="font-mono text-[10px] tracking-[0.4em] text-[#ff00aa] block uppercase">CHAPTER III // INDUCTION PHASES</span>
              <h2 className="text-4xl md:text-6xl font-light tracking-tight font-sans">The Collective.</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {operatives.map((op) => (
                <div key={op.id} className="operative-card border border-white/5 bg-[#07070c]/40 backdrop-blur-sm p-8 rounded-2xl flex flex-col justify-between space-y-8 hover:border-white/10 transition-all duration-300">
                  <div className="space-y-4">
                    <span className="font-mono text-[9px] tracking-widest bg-white/5 border border-white/5 px-2 py-0.5 rounded text-white/50 inline-block">{op.access}</span>
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

        {/* CHAPTER IV: SIGNAL */}
        <section id="signal" className="min-h-screen w-full flex items-center justify-center px-6 py-24 border-t border-white/5 relative bg-gradient-to-b from-black/40 to-black/80">
          <div className="max-w-3xl w-full text-center space-y-8 relative">
            <div className="space-y-2">
              <span className="font-mono text-[10px] tracking-[0.5em] text-[#c5a26f] block uppercase">CHAPTER IV // EPILOGUE</span>
              <h2 className="text-5xl md:text-8xl font-black tracking-tight font-sans">THE SIGNAL.</h2>
            </div>
            <p className="font-mono text-xs md:text-sm text-white/50 max-w-xl mx-auto leading-relaxed">If you have read this far, the resonance has already begun.</p>
            <div className="pt-4 space-y-4">
              <button onClick={() => setTerminalOpen(true)} className="font-mono text-[11px] tracking-[0.3em] border border-white/20 hover:border-white bg-transparent hover:bg-white hover:text-black px-8 py-4 transition-all duration-500 flex items-center gap-3 mx-auto">
                <Command size={14} /> ENGAGE SECURE INPUT
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-30 border-t border-white/5 bg-[#030307]/80 py-8 text-center font-mono text-[9px] tracking-[0.2em] text-white/30 space-y-2">
        <div>2026 • 1337</div>
        <div className="text-white/15 text-[8px]">
          THE CORPORATION
        </div>
      </footer>

      <TerminalModal 
        isOpen={terminalOpen} 
        onClose={() => setTerminalOpen(false)} 
      />

      <AnimatePresence>
        {!hasBooted && (
          <motion.div exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-[#05050a] flex flex-col items-center justify-center font-mono text-[10px] tracking-[0.4em] text-white">
            <motion.div initial={{ width: 0 }} animate={{ width: "160px" }} transition={{ duration: 0.9 }} className="h-[1px] bg-white mb-4" />
            <div className="animate-pulse text-white/60">LOADING...</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
