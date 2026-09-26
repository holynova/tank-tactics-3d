"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CombatFx } from "../../game/use-game-controller";
import type { Piece, Position, ThemeId } from "../../game/types";
import { THEMES } from "../../game/themes";
import { GameUnit } from "./UnitModels";
import { ThemeEnvironment } from "./ThemeEnvironment";

const CELL_GAP = 1.42;
const PROJECTILE_SECONDS = 0.72;

function worldPosition(position: Position): [number, number, number] {
  return [(position.col - 1.5) * CELL_GAP, 0.22, (position.row - 1.5) * CELL_GAP];
}

function AnimatedUnit({
  piece,
  themeId,
  selected,
  disabled,
  firing,
  aimTarget,
  onPress,
}: {
  piece: Piece;
  themeId: ThemeId;
  selected: boolean;
  disabled: boolean;
  firing: boolean;
  aimTarget: Position | null;
  onPress: (position: Position) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(...worldPosition(piece)), [piece]);
  const targetRotation = THREE.MathUtils.degToRad(180 - piece.facing);
  const aimAngle = useMemo(() => {
    if (!aimTarget) return 0;
    const [fromX, , fromZ] = worldPosition(piece);
    const [toX, , toZ] = worldPosition(aimTarget);
    return Math.atan2(toX - fromX, toZ - fromZ) - targetRotation;
  }, [aimTarget, piece, targetRotation]);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.lerp(target, 1 - Math.exp(-delta * 9));
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotation, 10, delta);
  });

  return (
    <group
      ref={group}
      position={target}
      rotation={[0, targetRotation, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (!disabled) onPress({ row: piece.row, col: piece.col });
      }}
    >
      <GameUnit
        themeId={themeId}
        color={piece.color}
        selected={selected}
        disabled={disabled}
        variant={Number(piece.id.split("-").at(-1)) || 0}
        aimAngle={aimAngle}
        firing={firing}
      />
    </group>
  );
}

function Cell({
  position,
  themeId,
  valid,
  selected,
  last,
  disabled,
  onPress,
}: {
  position: Position;
  themeId: ThemeId;
  valid: boolean;
  selected: boolean;
  last: boolean;
  disabled: boolean;
  onPress: (position: Position) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const theme = THEMES[themeId];
  const [x, , z] = worldPosition(position);
  const raised = valid || selected ? 0.08 : 0;

  return (
    <group position={[x, raised, z]}>
      <mesh
        receiveShadow
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (!disabled) onPress(position);
        }}
      >
        <boxGeometry args={[1.24, 0.18, 1.24]} />
        <meshStandardMaterial
          color={valid ? theme.accent : theme.cell}
          emissive={valid ? theme.accent : last ? theme.blue : "#000000"}
          emissiveIntensity={valid ? (hovered ? 0.72 : 0.36) : last ? 0.18 : 0}
          roughness={themeId === "lunar" ? 0.46 : 0.72}
          metalness={themeId === "lunar" ? 0.58 : 0.24}
        />
      </mesh>
      <mesh position={[0, -0.015, 0]}>
        <boxGeometry args={[1.13, 0.015, 1.13]} />
        <meshStandardMaterial color="#141d29" roughness={0.7} metalness={0.48} />
      </mesh>
      {valid && (
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.16, 0.25, 24]} />
          <meshBasicMaterial color={theme.accent} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.46, 0.56, 36]} />
          <meshBasicMaterial color={theme.accent} transparent opacity={0.86} toneMapped={false} />
        </mesh>
      )}
      {last && !selected && (
        <mesh position={[0.45, 0.1, 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.055, 14]} />
          <meshBasicMaterial color={theme.blue} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

interface Shot {
  id: string;
  from: THREE.Vector3;
  to: THREE.Vector3;
  accent: string;
  delay: number;
}

const SHELL_FORWARD = new THREE.Vector3(0, 0, 1);

function CannonShell({ shot, reducedMotion }: { shot: Shot; reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAt.current - shot.delay;
    if (!root.current || elapsed < 0) {
      if (root.current) root.current.visible = false;
      return;
    }
    root.current.visible = true;
    const duration = reducedMotion ? 0.36 : PROJECTILE_SECONDS;
    const progress = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
    const distance = shot.from.distanceTo(shot.to);
    const height = Math.min(1.6, distance * 0.2) + 0.72;
    root.current.position.copy(shot.from).lerp(shot.to, progress);
    root.current.position.y += Math.sin(progress * Math.PI) * height;
    velocity.current.copy(shot.to).sub(shot.from);
    velocity.current.y += height * Math.PI * Math.cos(progress * Math.PI);
    direction.current.copy(velocity.current).normalize();
    root.current.quaternion.setFromUnitVectors(SHELL_FORWARD, direction.current);
    if (glow.current) {
      const fade = progress > 0.9 ? 1 - (progress - 0.9) * 9 : 1;
      (glow.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fade * 0.72);
    }
  });

  return (
    <group ref={root} position={shot.from.toArray()}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.22, 8]} />
        <meshStandardMaterial color="#e5b762" emissive="#98420f" emissiveIntensity={0.62} metalness={0.84} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0, 0.145]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.12, 8]} />
        <meshStandardMaterial color="#fbe1a2" emissive="#ad5421" emissiveIntensity={0.42} metalness={0.56} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0, -0.145]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.047, 0.047, 0.045, 8]} />
        <meshStandardMaterial color="#292b2c" metalness={0.74} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0, -0.19]} ref={glow} scale={[0.055, 0.055, 0.12]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ff9d4c" transparent opacity={0.48} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <pointLight color="#ff9a45" intensity={1.6} distance={1.05} decay={2} />
    </group>
  );
}

function MuzzleFlash({ shot }: { shot: Shot }) {
  const flare = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    if (!flare.current) return;
    const progress = Math.max(0, (clock.elapsedTime - startedAt.current - shot.delay) / 0.18);
    flare.current.visible = progress < 1;
    flare.current.scale.setScalar(0.48 + Math.min(progress, 1) * 1.3);
    (flare.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress);
  });
  const direction = shot.to.clone().sub(shot.from);
  const angle = Math.atan2(direction.x, direction.z);
  const position = shot.from.clone().add(direction.normalize().multiplyScalar(0.18));
  position.y += 0.01;
  return (
    <group position={position} rotation={[0, angle, 0]}>
      <mesh ref={flare} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.42, 9]} />
        <meshBasicMaterial color="#ffcf7a" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <pointLight color="#ff8a39" intensity={5} distance={1.9} decay={2} />
    </group>
  );
}

interface Particle {
  velocity: THREE.Vector3;
  size: number;
  spin: THREE.Vector3;
  color: THREE.Color;
}

function Explosion({ position, color, reducedMotion }: {
  position: [number, number, number];
  color: string;
  reducedMotion: boolean;
}) {
  const shards = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const smoke = useRef<Array<THREE.Mesh | null>>([]);
  const startedAt = useRef<number | null>(null);
  const mobile = useThree((state) => state.size.width < 620);
  const count = reducedMotion ? 8 : mobile ? 30 : 44;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const center = useMemo(() => new THREE.Vector3(...position), [position]);
  const particles = useMemo<Particle[]>(() => Array.from({ length: count }, (_, index) => {
    const seed = index * 2.399963229728653;
    const planar = 0.48 + ((index * 37) % 100) / 80;
    return {
      velocity: new THREE.Vector3(Math.cos(seed) * planar, 0.6 + ((index * 19) % 100) / 55, Math.sin(seed) * planar),
      size: 0.035 + ((index * 13) % 100) / 3600,
      spin: new THREE.Vector3(seed * 0.5, seed * 0.3, seed),
      color: new THREE.Color(index % 7 === 0 ? "#fff1b3" : index % 3 === 0 ? "#ff6b35" : color),
    };
  }), [color, count]);

  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - startedAt.current) / (reducedMotion ? 0.42 : 0.88));
    if (ring.current) {
      ring.current.scale.setScalar(1 + t * 5.5);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.92 * (1 - t);
    }
    if (flash.current) {
      const size = 0.18 + Math.sin(Math.min(1, t * 3) * Math.PI) * 0.5 + t * 0.8;
      flash.current.scale.setScalar(size);
      (flash.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t * 4.8);
    }
    if (shards.current) {
      const alive = 1 - t;
      particles.forEach((particle, index) => {
        dummy.position.copy(center).addScaledVector(particle.velocity, t * (reducedMotion ? 0.55 : 1.1));
        dummy.position.y -= t * t * 1.35;
        dummy.rotation.set(
          particle.spin.x * t,
          particle.spin.y * t,
          particle.spin.z * t,
        );
        const size = particle.size * Math.max(0.18, 1 - t * 0.46);
        dummy.scale.set(size * (1 + (index % 4) * 0.4), size, size * (1 + (index % 5) * 0.24));
        dummy.updateMatrix();
        shards.current!.setMatrixAt(index, dummy.matrix);
        shards.current!.setColorAt(index, particle.color.clone().multiplyScalar(alive));
      });
      shards.current.instanceMatrix.needsUpdate = true;
      if (shards.current.instanceColor) shards.current.instanceColor.needsUpdate = true;
    }
    smoke.current.forEach((puff, index) => {
      if (!puff) return;
      const angle = (index / 5) * Math.PI * 2;
      puff.position.set(
        position[0] + Math.cos(angle) * (0.14 + t * 0.34),
        position[1] + 0.08 + t * (0.48 + index % 3 * 0.08),
        position[2] + Math.sin(angle) * (0.14 + t * 0.34),
      );
      const scale = (0.14 + t * 0.36) * (1 + (index % 2) * 0.22);
      puff.scale.set(scale, scale * 0.78, scale);
      const material = puff.material as THREE.MeshBasicMaterial;
      material.opacity = (reducedMotion ? 0.17 : 0.26) * (1 - t);
    });
  });

  return (
    <group>
      <mesh ref={flash} position={position}>
        <sphereGeometry args={[0.42, 14, 10]} />
        <meshBasicMaterial color="#fff2b7" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={ring} position={[position[0], 0.27, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.17, 0.3, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.96} depthWrite={false} toneMapped={false} />
      </mesh>
      <instancedMesh ref={shards} args={[undefined, undefined, count]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ffffff" vertexColors transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh key={index} ref={(mesh) => { smoke.current[index] = mesh; }} position={position}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#584c46" transparent opacity={0.24} depthWrite={false} />
        </mesh>
      ))}
      <pointLight position={[position[0], position[1] + 0.3, position[2]]} color={color} intensity={6} distance={3.4} decay={2} />
    </group>
  );
}

function AttackEffects({ pieces, fx, themeId, reducedMotion }: {
  pieces: Piece[];
  fx: CombatFx;
  themeId: ThemeId;
  reducedMotion: boolean;
}) {
  const theme = THEMES[themeId];
  const attackers = pieces.filter((piece) => fx.attackerIds.includes(piece.id));
  const victims = pieces.filter((piece) => fx.victimIds.includes(piece.id));
  const shots = victims.flatMap((victim, victimIndex) => {
    const aligned = attackers
      .filter((attacker) => attacker.row === victim.row || attacker.col === victim.col)
      .sort((a, b) => Math.abs(a.row - victim.row) + Math.abs(a.col - victim.col) - (Math.abs(b.row - victim.row) + Math.abs(b.col - victim.col)));
    const firingPair = (aligned.length >= 2 ? aligned : attackers).slice(0, 2);
    return firingPair.map((attacker, shooterIndex) => {
      const from = new THREE.Vector3(...worldPosition(attacker));
      const to = new THREE.Vector3(...worldPosition(victim));
      from.y = 0.92;
      to.y = 0.52;
      const heading = to.clone().sub(from);
      const direction = heading.clone().setY(0).normalize();
      from.addScaledVector(direction, 0.44);
      return {
        id: `${attacker.id}-${victim.id}`,
        from,
        to,
        accent: attacker.color === "red" ? theme.red : theme.blue,
        delay: victimIndex * 0.12 + shooterIndex * 0.045,
      } satisfies Shot;
    });
  });

  return (
    <>
      {shots.map((shot) => <CannonShell key={shot.id} shot={shot} reducedMotion={reducedMotion} />)}
      {shots.map((shot) => <MuzzleFlash key={`muzzle-${shot.id}`} shot={shot} />)}
      {fx.burstPositions.map((position, index) => {
        const [x, , z] = worldPosition(position);
        return (
          <Explosion
            key={`${position.row}-${position.col}-${index}`}
            position={[x, 0.54, z]}
            color={theme.accent}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </>
  );
}

export interface CameraCommands {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

interface GameBoard3DProps {
  pieces: Piece[];
  selectedId: string | null;
  validMoves: Position[];
  themeId: ThemeId;
  lastMove: Position | null;
  fx: CombatFx;
  disabled: boolean;
  onCellPress: (position: Position) => void;
}

export function GameBoard3D({
  pieces,
  selectedId,
  validMoves,
  themeId,
  lastMove,
  fx,
  disabled,
  onCellPress,
}: GameBoard3DProps) {
  const theme = THEMES[themeId];
  const controls = useRef<OrbitControlsImpl>(null);
  const mobileLayout = typeof window !== "undefined" && window.innerWidth < 620;
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const zoom = (inward: boolean) => {
    const controlsApi = controls.current;
    if (!controlsApi) return;
    // three-stdlib expresses perspective dolly as a radius scale; dollyOut's
    // reciprocal scale brings the camera closer in the pinned Drei version.
    if (inward) controlsApi.dollyOut(1.2);
    else controlsApi.dollyIn(1.2);
    controlsApi.update();
  };

  return (
    <div className="game-board-layer">
      <Canvas
        className="game-canvas"
        dpr={[1, 1.45]}
        camera={{
          position: mobileLayout ? [0, 10.4, 8.2] : [7.4, 10.8, 8.6],
          fov: mobileLayout ? 54 : 36,
          near: 0.1,
          far: 80,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onPointerMissed={() => undefined}
        style={{ background: theme.background }}
      >
        <OrbitControls
          ref={controls}
          makeDefault
          enableDamping
          dampingFactor={0.085}
          enablePan
          enableRotate
          enableZoom
          minDistance={8.2}
          maxDistance={18}
          minPolarAngle={0.24}
          maxPolarAngle={1.37}
          target={[0, 0.05, 0]}
          zoomSpeed={0.72}
          rotateSpeed={0.72}
          panSpeed={0.65}
        />
        <color attach="background" args={[theme.background]} />
        <ThemeEnvironment themeId={themeId} />

        <group>
          <mesh position={[0, -0.2, 0]} receiveShadow castShadow>
            <boxGeometry args={[6.45, 0.38, 6.45]} />
            <meshStandardMaterial color={theme.board} roughness={0.62} metalness={0.48} />
          </mesh>
          <mesh position={[0, -0.405, 0]}>
            <boxGeometry args={[6.22, 0.065, 6.22]} />
            <meshStandardMaterial color="#111824" roughness={0.4} metalness={0.82} />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <boxGeometry args={[5.95, 0.045, 5.95]} />
            <meshStandardMaterial color="#101720" roughness={0.64} metalness={0.52} />
          </mesh>

          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 4 }, (_, col) => {
              const position = { row, col };
              const piece = pieces.find((candidate) => candidate.row === row && candidate.col === col);
              return (
                <Cell
                  key={`${row}-${col}`}
                  position={position}
                  themeId={themeId}
                  valid={validMoves.some((move) => move.row === row && move.col === col)}
                  selected={piece?.id === selectedId}
                  last={lastMove?.row === row && lastMove?.col === col}
                  disabled={disabled}
                  onPress={onCellPress}
                />
              );
            }),
          )}

          {pieces.map((piece) => {
            const targets = pieces
              .filter((candidate) => fx.victimIds.includes(candidate.id))
              .sort((a, b) => Math.abs(a.row - piece.row) + Math.abs(a.col - piece.col) - (Math.abs(b.row - piece.row) + Math.abs(b.col - piece.col)));
            const aimTarget = fx.attackerIds.includes(piece.id) ? targets[0] ?? null : null;
            return (
              <AnimatedUnit
                key={piece.id}
                piece={piece}
                themeId={themeId}
                selected={piece.id === selectedId}
                disabled={disabled || fx.victimIds.includes(piece.id)}
                firing={fx.attackerIds.includes(piece.id)}
                aimTarget={aimTarget}
                onPress={onCellPress}
              />
            );
          })}
          <AttackEffects pieces={pieces} fx={fx} themeId={themeId} reducedMotion={reducedMotion} />
        </group>
      </Canvas>

      <div className="camera-controls-rail" role="group" aria-label="战场视角">
        <button type="button" aria-label="放大视角" title="放大" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoom(true)}>
          <Plus aria-hidden="true" />
        </button>
        <button type="button" aria-label="缩小视角" title="缩小" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoom(false)}>
          <Minus aria-hidden="true" />
        </button>
        <button type="button" aria-label="重置战场视角" title="重置视角" onPointerDown={(event) => event.stopPropagation()} onClick={() => controls.current?.reset()}>
          <RotateCcw aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
