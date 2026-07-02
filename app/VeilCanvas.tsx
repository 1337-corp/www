"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hash01 } from "./graphics";
import CoreFallback from "./CoreFallback";

// This module is loaded on demand via next/dynamic, so three.js stays out
// of the initial page bundle and only downloads when the site is actually
// able to render the 3D core.

// =========================================================================
// FAR FIELD — a sparse seeded starfield (replaces the old drei <Stars>
// with a dependency-free, deterministic shell of points).
// =========================================================================
function FarField() {
  const positions = useMemo(() => {
    const count = 60;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 70 + hash01(i * 3.1) * 30;
      const theta = hash01(i * 7.7) * Math.PI * 2;
      const phi = Math.acos(2 * hash01(i * 13.3) - 1);
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = radius * Math.cos(phi);
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.5} color="#ffffff" transparent opacity={0.5} depthWrite={false} sizeAttenuation />
    </points>
  );
}

// =========================================================================
// THE VEIL CRUCIBLE: 3D THREE.JS QUANTUM INTEGRATION
// =========================================================================
function TheVeilCore({
  mouse,
  pulseTrigger,
  activeColor,
}: {
  mouse: React.RefObject<{ x: number; y: number }>;
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
      // Deterministic pseudo-random placement — render-pure, no unseeded source.
      const radiusBase = 2.4 + (i % 4) * 0.5 + (hash01(i + 11) - 0.5) * 0.3;
      const theta = hash01(i + 29) * Math.PI * 2;
      const phi = Math.acos(2 * hash01(i + 47) - 1) * 0.8;

      homes[i3] = radiusBase * Math.sin(phi) * Math.cos(theta);
      homes[i3 + 1] = radiusBase * Math.sin(phi) * Math.sin(theta) * 0.8;
      homes[i3 + 2] = radiusBase * Math.cos(phi);
    }
    return { homePositions: homes };
  }, []);

  const positions = useMemo(() => new Float32Array(homePositions), [homePositions]);
  // Velocities live in a ref (a mutable buffer), never in render-derived state,
  // so per-frame mutation doesn't violate render purity.
  const velocitiesRef = useRef<Float32Array>(new Float32Array(particleCount * 3));
  const pulseRef = useRef(0);

  useEffect(() => {
    if (pulseTrigger > 0 && particlesRef.current) {
      pulseRef.current = 1.0;
      const velocities = velocitiesRef.current;
      const posArr = (particlesRef.current.geometry.attributes.position as THREE.BufferAttribute)
        .array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const len = Math.sqrt(posArr[i3] ** 2 + posArr[i3 + 1] ** 2 + posArr[i3 + 2] ** 2) || 1;
        velocities[i3] += (posArr[i3] / len) * 0.9;
        velocities[i3 + 1] += (posArr[i3 + 1] / len) * 0.9;
        velocities[i3 + 2] += (posArr[i3 + 2] / len) * 0.9;
      }
    }
  }, [pulseTrigger, particleCount]);

  useFrame((state, delta) => {
    if (!groupRef.current || !particlesRef.current) return;

    const time = state.clock.elapsedTime;
    const velocities = velocitiesRef.current;
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

    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      mouse.current.x * 2.5,
      0.05
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      mouse.current.y * 2.0,
      0.05
    );

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
      <FarField />
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
// COMPONENT: CANVAS ERROR BOUNDARY
// =========================================================================
// react-three-fiber throws synchronously if a WebGL context cannot be created.
// Without a boundary that throw unmounts the whole route (blank page). This
// catches it and renders the static fallback instead.
class CanvasErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("veil core: live scene failed, using fallback —", error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// =========================================================================
// DEFAULT EXPORT: the mounted <Canvas> wrapped in its safety boundary
// =========================================================================
export default function VeilCanvas({
  mouse,
  pulseTrigger,
  activeColor,
  frameloop,
}: {
  mouse: React.RefObject<{ x: number; y: number }>;
  pulseTrigger: number;
  activeColor: string;
  // "never" pauses all rendering when the core is scrolled out of view.
  frameloop: "always" | "never";
}) {
  return (
    <CanvasErrorBoundary fallback={<CoreFallback color={activeColor} />}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        gl={{ alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.15} />
        <pointLight position={[5, 5, 5]} intensity={0.5} />
        <TheVeilCore mouse={mouse} pulseTrigger={pulseTrigger} activeColor={activeColor} />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
