"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CombatFx } from "../../game/use-game-controller";
import type { Piece, Position, ThemeId } from "../../game/types";
import { THEMES } from "../../game/themes";
import { GameUnit } from "./UnitModels";
import { ThemeEnvironment } from "./ThemeEnvironment";

const CELL_GAP = 1.42;

function worldPosition(position: Position): [number, number, number] {
  return [(position.col - 1.5) * CELL_GAP, 0.22, (position.row - 1.5) * CELL_GAP];
}

function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const mobile = size.width < 620;
    camera.position.set(mobile ? 7.7 : 7.2, mobile ? 10.1 : 7.4, mobile ? 8.6 : 7.3);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = mobile ? 46 : 34;
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}

function AnimatedUnit({
  piece,
  themeId,
  selected,
  disabled,
  onPress,
}: {
  piece: Piece;
  themeId: ThemeId;
  selected: boolean;
  disabled: boolean;
  onPress: (position: Position) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(...worldPosition(piece)), [piece]);
  const targetRotation = THREE.MathUtils.degToRad(180 - piece.facing);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.lerp(target, 1 - Math.exp(-delta * 9));
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      targetRotation,
      10,
      delta,
    );
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
      <GameUnit themeId={themeId} color={piece.color} selected={selected} disabled={disabled} />
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
          roughness={themeId === "lunar" ? 0.46 : 0.78}
          metalness={themeId === "lunar" ? 0.48 : 0.08}
        />
      </mesh>
      {valid && (
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.16, 0.25, 24]} />
          <meshBasicMaterial color={theme.accent} transparent opacity={0.9} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.46, 0.56, 36]} />
          <meshBasicMaterial color={theme.accent} transparent opacity={0.88} />
        </mesh>
      )}
    </group>
  );
}

function AttackEffects({ pieces, fx, themeId }: { pieces: Piece[]; fx: CombatFx; themeId: ThemeId }) {
  const theme = THEMES[themeId];
  const attackers = pieces.filter((piece) => fx.attackerIds.includes(piece.id));
  const victims = pieces.filter((piece) => fx.victimIds.includes(piece.id));

  return (
    <>
      {attackers.flatMap((attacker) =>
        victims.map((victim) => {
          const from = worldPosition(attacker);
          const to = worldPosition(victim);
          from[1] = 0.88;
          to[1] = 0.72;
          return (
            <Line
              key={`${attacker.id}-${victim.id}`}
              points={[from, to]}
              color={attacker.color === "red" ? theme.red : theme.blue}
              lineWidth={4}
              transparent
              opacity={0.9}
            />
          );
        }),
      )}
      {fx.burstPositions.map((position, index) => {
        const [x, , z] = worldPosition(position);
        return <Burst key={`${position.row}-${position.col}-${index}`} position={[x, 0.7, z]} color={theme.accent} />;
      })}
    </>
  );
}

function Burst({ position, color }: { position: [number, number, number]; color: string }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!ring.current) return;
    ring.current.scale.multiplyScalar(1 + delta * 4.5);
    const material = ring.current.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, material.opacity - delta * 2.1);
  });
  return (
    <mesh ref={ring} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.16, 0.3, 28]} />
      <meshBasicMaterial color={color} transparent opacity={0.96} depthWrite={false} />
    </mesh>
  );
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

  return (
    <Canvas
      className="game-canvas"
      dpr={[1, 1.6]}
      camera={{ position: [6.5, 8.5, 7.2], fov: 34, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => undefined}
      style={{ background: theme.background }}
    >
      <CameraRig />
      <color attach="background" args={[theme.background]} />
      <ThemeEnvironment themeId={themeId} />

      <group>
        <mesh position={[0, -0.18, 0]} receiveShadow>
          <boxGeometry args={[6.15, 0.28, 6.15]} />
          <meshStandardMaterial color={theme.board} roughness={0.75} metalness={0.16} />
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

        {pieces.map((piece) => (
          <AnimatedUnit
            key={piece.id}
            piece={piece}
            themeId={themeId}
            selected={piece.id === selectedId}
            disabled={disabled || fx.victimIds.includes(piece.id)}
            onPress={onCellPress}
          />
        ))}
        <AttackEffects pieces={pieces} fx={fx} themeId={themeId} />
      </group>
    </Canvas>
  );
}
