"use client";

import { Float } from "@react-three/drei";
import type { PlayerColor, ThemeId } from "../../game/types";
import { THEMES } from "../../game/themes";
import * as THREE from "three";

export interface GameUnitProps {
  themeId: ThemeId;
  color: PlayerColor;
  selected: boolean;
  disabled?: boolean;
}

type SurfaceFinish = "body" | "trim" | "accent" | "glass";

interface UnitPalette {
  body: string;
  trim: string;
  accent: string;
  glass: string;
  selected: boolean;
  disabled: boolean;
  opacity: number;
}

interface ModelProps {
  palette: UnitPalette;
}

const TRIM_COLORS: Record<ThemeId, string> = {
  lunar: "#11192b",
  sky: "#4c5c5d",
  abyss: "#082b35",
};

const GLASS_COLORS: Record<ThemeId, string> = {
  lunar: "#1a294b",
  sky: "#537d83",
  abyss: "#0b485d",
};

function getPalette(
  themeId: ThemeId,
  color: PlayerColor,
  selected: boolean,
  disabled: boolean,
): UnitPalette {
  const theme = THEMES[themeId];

  return {
    body: color === "red" ? theme.red : theme.blue,
    trim: TRIM_COLORS[themeId],
    accent: theme.accent,
    glass: GLASS_COLORS[themeId],
    selected: selected && !disabled,
    disabled,
    opacity: disabled ? 0.42 : 1,
  };
}

interface SurfaceProps {
  finish: SurfaceFinish;
  palette: UnitPalette;
  roughness?: number;
  metalness?: number;
  alpha?: number;
}

function Surface({
  finish,
  palette,
  roughness = 0.68,
  metalness = 0.15,
  alpha,
}: SurfaceProps) {
  const materialColor = palette[finish];
  const opacity = alpha ?? palette.opacity;
  const transparent = palette.disabled || alpha !== undefined;
  const isSelectedAccent = finish === "accent" && palette.selected;

  return (
    <meshStandardMaterial
      color={materialColor}
      roughness={roughness}
      metalness={metalness}
      flatShading
      transparent={transparent}
      opacity={opacity}
      depthWrite={!transparent}
      emissive={isSelectedAccent ? palette.accent : "#000000"}
      emissiveIntensity={isSelectedAccent ? 0.42 : 0}
    />
  );
}

function LunarMech({ palette }: ModelProps) {
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.33, 0.38, 0.16, 8]} />
        <Surface finish="trim" palette={palette} roughness={0.48} metalness={0.72} />
      </mesh>

      <mesh position={[-0.13, 0.22, 0]}>
        <boxGeometry args={[0.16, 0.27, 0.2]} />
        <Surface finish="trim" palette={palette} roughness={0.5} metalness={0.68} />
      </mesh>
      <mesh position={[0.13, 0.22, 0]}>
        <boxGeometry args={[0.16, 0.27, 0.2]} />
        <Surface finish="trim" palette={palette} roughness={0.5} metalness={0.68} />
      </mesh>
      <mesh position={[-0.13, 0.1, 0.08]}>
        <boxGeometry args={[0.19, 0.08, 0.28]} />
        <Surface finish="body" palette={palette} roughness={0.56} metalness={0.58} />
      </mesh>
      <mesh position={[0.13, 0.1, 0.08]}>
        <boxGeometry args={[0.19, 0.08, 0.28]} />
        <Surface finish="body" palette={palette} roughness={0.56} metalness={0.58} />
      </mesh>

      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.46, 0.52, 0.34]} />
        <Surface finish="body" palette={palette} roughness={0.52} metalness={0.62} />
      </mesh>
      <mesh position={[0, 0.52, 0.18]}>
        <boxGeometry args={[0.26, 0.12, 0.035]} />
        <Surface finish="accent" palette={palette} roughness={0.32} metalness={0.2} />
      </mesh>

      <mesh position={[-0.3, 0.57, 0]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.18, 0.25, 0.3]} />
        <Surface finish="trim" palette={palette} roughness={0.46} metalness={0.64} />
      </mesh>
      <mesh position={[0.3, 0.57, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.18, 0.25, 0.3]} />
        <Surface finish="trim" palette={palette} roughness={0.46} metalness={0.64} />
      </mesh>

      <mesh position={[0, 0.81, 0.01]}>
        <boxGeometry args={[0.34, 0.25, 0.29]} />
        <Surface finish="trim" palette={palette} roughness={0.44} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.8, 0.17]}>
        <boxGeometry args={[0.2, 0.06, 0.025]} />
        <Surface finish="accent" palette={palette} roughness={0.28} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.01, -0.01]}>
        <cylinderGeometry args={[0.025, 0.025, 0.18, 6]} />
        <Surface finish="accent" palette={palette} roughness={0.28} metalness={0.34} />
      </mesh>

      <mesh position={[0.3, 0.67, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.065, 0.075, 0.38, 8]} />
        <Surface finish="body" palette={palette} roughness={0.48} metalness={0.64} />
      </mesh>
      <mesh position={[0.3, 0.67, 0.37]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.084, 0.084, 0.045, 8]} />
        <Surface finish="accent" palette={palette} roughness={0.3} metalness={0.26} />
      </mesh>
    </group>
  );
}

function SkyGuardian({ palette }: ModelProps) {
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.42, 0.35, 0.16, 7]} />
        <Surface finish="trim" palette={palette} roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.28, 0]} scale={[1, 0.65, 0.86]}>
        <dodecahedronGeometry args={[0.42, 0]} />
        <Surface finish="body" palette={palette} roughness={0.94} metalness={0.01} />
      </mesh>

      <mesh position={[-0.3, 0.52, -0.01]} rotation={[0.1, 0, -0.24]}>
        <octahedronGeometry args={[0.2, 0]} />
        <Surface finish="body" palette={palette} roughness={0.92} metalness={0.01} />
      </mesh>
      <mesh position={[0.3, 0.52, -0.01]} rotation={[-0.1, 0, 0.24]}>
        <octahedronGeometry args={[0.2, 0]} />
        <Surface finish="body" palette={palette} roughness={0.92} metalness={0.01} />
      </mesh>
      <mesh position={[-0.34, 0.25, 0.03]} scale={[0.72, 1.15, 0.75]}>
        <icosahedronGeometry args={[0.16, 0]} />
        <Surface finish="trim" palette={palette} roughness={0.92} metalness={0.01} />
      </mesh>
      <mesh position={[0.34, 0.25, 0.03]} scale={[0.72, 1.15, 0.75]}>
        <icosahedronGeometry args={[0.16, 0]} />
        <Surface finish="trim" palette={palette} roughness={0.92} metalness={0.01} />
      </mesh>

      <mesh position={[0, 0.66, 0.01]} scale={[0.82, 1.12, 0.72]}>
        <coneGeometry args={[0.29, 0.34, 5]} />
        <Surface finish="body" palette={palette} roughness={0.92} metalness={0.01} />
      </mesh>
      <mesh position={[0, 0.7, 0.25]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.08, 0.18, 4]} />
        <Surface finish="accent" palette={palette} roughness={0.66} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.66, 0.27]}>
        <planeGeometry args={[0.2, 0.09]} />
        <Surface finish="accent" palette={palette} roughness={0.52} metalness={0.01} />
      </mesh>

      <mesh position={[-0.26, 0.72, -0.05]} rotation={[0, 0, -0.44]}>
        <coneGeometry args={[0.1, 0.34, 4]} />
        <Surface finish="trim" palette={palette} roughness={0.88} metalness={0.01} />
      </mesh>
      <mesh position={[0.26, 0.72, -0.05]} rotation={[0, 0, 0.44]}>
        <coneGeometry args={[0.1, 0.34, 4]} />
        <Surface finish="trim" palette={palette} roughness={0.88} metalness={0.01} />
      </mesh>
    </group>
  );
}

function AbyssSubmersible({ palette }: ModelProps) {
  return (
    <group>
      <mesh position={[0, 0.34, 0]} scale={[0.86, 0.56, 1.18]}>
        <sphereGeometry args={[0.43, 8, 5]} />
        <Surface finish="body" palette={palette} roughness={0.36} metalness={0.72} />
      </mesh>
      <mesh position={[0, 0.36, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.19, 0.16, 8]} />
        <Surface finish="trim" palette={palette} roughness={0.34} metalness={0.76} />
      </mesh>
      <mesh position={[0, 0.36, -0.57]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.16, 8]} />
        <Surface finish="accent" palette={palette} roughness={0.28} metalness={0.32} />
      </mesh>

      <mesh position={[0, 0.56, 0.08]} scale={[0.9, 0.68, 1.08]}>
        <sphereGeometry args={[0.22, 8, 4]} />
        <Surface
          finish="glass"
          palette={palette}
          roughness={0.18}
          metalness={0.46}
          alpha={palette.disabled ? 0.25 : 0.7}
        />
      </mesh>
      <mesh position={[0, 0.56, 0.3]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.18, 0.025, 5, 8]} />
        <Surface finish="accent" palette={palette} roughness={0.26} metalness={0.26} />
      </mesh>

      <mesh position={[-0.33, 0.28, 0.02]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.34, 0.06, 0.28]} />
        <Surface finish="trim" palette={palette} roughness={0.34} metalness={0.68} />
      </mesh>
      <mesh position={[0.33, 0.28, 0.02]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.34, 0.06, 0.28]} />
        <Surface finish="trim" palette={palette} roughness={0.34} metalness={0.68} />
      </mesh>
      <mesh position={[0, 0.58, -0.1]} rotation={[0.16, 0, 0]}>
        <boxGeometry args={[0.08, 0.16, 0.24]} />
        <Surface finish="trim" palette={palette} roughness={0.3} metalness={0.7} />
      </mesh>

      <mesh position={[0, 0.34, 0.47]}>
        <sphereGeometry args={[0.075, 8, 4]} />
        <Surface finish="accent" palette={palette} roughness={0.2} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.34, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.028, 8]} />
        <Surface finish="accent" palette={palette} roughness={0.22} metalness={0.2} />
      </mesh>
    </group>
  );
}

function SelectionFeedback({ palette }: ModelProps) {
  if (!palette.selected) return null;

  return (
    <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.43, 0.49, 24]} />
      <meshBasicMaterial
        color={palette.accent}
        transparent
        opacity={0.42}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/**
 * A theme-specific low-poly unit. The root has no position or rotation so a
 * board can own piece placement and facing; every model's front points toward
 * local +Z.
 */
export function GameUnit({
  themeId,
  color,
  selected,
  disabled = false,
}: GameUnitProps) {
  const palette = getPalette(themeId, color, selected, disabled);
  const model =
    themeId === "lunar" ? (
      <LunarMech palette={palette} />
    ) : themeId === "sky" ? (
      <SkyGuardian palette={palette} />
    ) : (
      <AbyssSubmersible palette={palette} />
    );

  return (
    <Float
      enabled={palette.selected}
      speed={0.8}
      rotationIntensity={0.035}
      floatIntensity={0.12}
      floatingRange={[-0.045, 0.045]}
    >
      <group>
        {model}
        <SelectionFeedback palette={palette} />
      </group>
    </Float>
  );
}

