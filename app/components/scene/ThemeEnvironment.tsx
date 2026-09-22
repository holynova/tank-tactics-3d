"use client";

import type { ThemeId } from "../../game/types";
import { THEMES } from "../../game/themes";

export interface ThemeEnvironmentProps {
  themeId: ThemeId;
}

interface EnvironmentMaterialProps {
  color: string;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
}

function EnvironmentMaterial({
  color,
  roughness = 0.82,
  metalness = 0,
  transparent = false,
  opacity = 1,
}: EnvironmentMaterialProps) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      transparent={transparent}
      opacity={opacity}
      depthWrite={!transparent}
    />
  );
}

function LunarEnvironment() {
  return (
    <group>
      <mesh position={[-4.7, -0.02, -3.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.52, 0.76, 16]} />
        <meshBasicMaterial color="#5f6983" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh position={[4.5, -0.01, 3.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.62, 14]} />
        <meshBasicMaterial color="#707b93" transparent opacity={0.26} depthWrite={false} />
      </mesh>

      <mesh position={[-4.65, 0.32, -3.5]} rotation={[0.1, 0.4, -0.12]}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <EnvironmentMaterial color="#3b4358" roughness={0.97} />
      </mesh>
      <mesh position={[4.55, 0.4, 3.45]} rotation={[-0.12, -0.45, 0.2]}>
        <icosahedronGeometry args={[0.58, 0]} />
        <EnvironmentMaterial color="#414a61" roughness={0.97} />
      </mesh>
      <mesh position={[5.1, 0.56, -3.6]} rotation={[0.1, 0, 0.2]}>
        <coneGeometry args={[0.3, 1.05, 6]} />
        <EnvironmentMaterial color="#32394e" roughness={0.96} />
      </mesh>
      <mesh position={[-5.1, 0.5, 3.5]} rotation={[-0.08, 0.25, -0.14]}>
        <coneGeometry args={[0.28, 0.9, 6]} />
        <EnvironmentMaterial color="#32394e" roughness={0.96} />
      </mesh>

      <mesh position={[0, 2.6, -6.7]} rotation={[0.16, 0, 0]}>
        <torusGeometry args={[1.25, 0.035, 6, 18]} />
        <meshBasicMaterial color="#8a96b2" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0.42, 2.6, -6.7]}>
        <sphereGeometry args={[0.16, 8, 4]} />
        <meshBasicMaterial color="#e8ff60" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SkyEnvironment() {
  return (
    <group>
      <group position={[-4.9, 0, -3.7]}>
        <mesh position={[0, 0.48, 0]} scale={[1.2, 0.6, 0.82]}>
          <icosahedronGeometry args={[0.72, 1]} />
          <EnvironmentMaterial color="#deedf0" roughness={1} />
        </mesh>
        <mesh position={[0.7, 0.36, 0.12]} scale={[0.82, 0.45, 0.62]}>
          <icosahedronGeometry args={[0.6, 1]} />
          <EnvironmentMaterial color="#d3e6ea" roughness={1} />
        </mesh>
      </group>
      <group position={[4.6, 0, -3.9]}>
        <mesh position={[0, 0.42, 0]} scale={[1.15, 0.56, 0.78]}>
          <icosahedronGeometry args={[0.68, 1]} />
          <EnvironmentMaterial color="#e0eff1" roughness={1} />
        </mesh>
        <mesh position={[-0.68, 0.34, 0.06]} scale={[0.78, 0.42, 0.58]}>
          <icosahedronGeometry args={[0.58, 1]} />
          <EnvironmentMaterial color="#d2e6ea" roughness={1} />
        </mesh>
      </group>

      <mesh position={[-4.55, 0.7, 3.65]} rotation={[0, 0, -0.08]}>
        <cylinderGeometry args={[0.31, 0.46, 1.45, 6]} />
        <EnvironmentMaterial color="#85958d" roughness={0.97} />
      </mesh>
      <mesh position={[4.85, 0.84, 3.55]} rotation={[0, 0.15, 0.12]}>
        <cylinderGeometry args={[0.34, 0.5, 1.68, 6]} />
        <EnvironmentMaterial color="#7e918b" roughness={0.97} />
      </mesh>
      <mesh position={[-4.62, 1.48, 3.65]} rotation={[0, 0, -0.08]}>
        <coneGeometry args={[0.34, 0.5, 6]} />
        <EnvironmentMaterial color="#a5b5aa" roughness={0.98} />
      </mesh>
      <mesh position={[4.9, 1.7, 3.55]} rotation={[0, 0.15, 0.12]}>
        <coneGeometry args={[0.38, 0.56, 6]} />
        <EnvironmentMaterial color="#9eafa7" roughness={0.98} />
      </mesh>

      <mesh position={[0, 3.5, -7]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.2, 0.045, 6, 24]} />
        <meshBasicMaterial color="#e9f8f4" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  );
}

function AbyssEnvironment() {
  return (
    <group>
      <group position={[-4.75, 0, -3.7]}>
        <mesh position={[0, 0.72, 0]} rotation={[0, 0.22, -0.08]}>
          <cylinderGeometry args={[0.22, 0.48, 1.8, 6]} />
          <EnvironmentMaterial color="#0d4a4c" roughness={0.9} />
        </mesh>
        <mesh position={[0.22, 0.78, 0.08]} rotation={[0, -0.12, 0.12]}>
          <cylinderGeometry args={[0.13, 0.31, 1.48, 5]} />
          <EnvironmentMaterial color="#14605c" roughness={0.88} />
        </mesh>
        <mesh position={[-0.16, 1.72, 0]}>
          <sphereGeometry args={[0.12, 7, 4]} />
          <meshBasicMaterial color="#65ffc7" transparent opacity={0.62} depthWrite={false} />
        </mesh>
      </group>

      <group position={[4.65, 0, -3.8]}>
        <mesh position={[0, 0.75, 0]} rotation={[0, -0.22, 0.12]}>
          <cylinderGeometry args={[0.2, 0.44, 1.88, 6]} />
          <EnvironmentMaterial color="#0b454c" roughness={0.9} />
        </mesh>
        <mesh position={[-0.25, 0.9, 0.06]} rotation={[0, 0.16, -0.1]}>
          <cylinderGeometry args={[0.12, 0.3, 1.56, 5]} />
          <EnvironmentMaterial color="#12575b" roughness={0.88} />
        </mesh>
        <mesh position={[0.18, 1.82, 0]}>
          <sphereGeometry args={[0.12, 7, 4]} />
          <meshBasicMaterial color="#65ffc7" transparent opacity={0.58} depthWrite={false} />
        </mesh>
      </group>

      <mesh position={[-4.8, 0.54, 3.65]} rotation={[0.04, 0.38, -0.08]}>
        <boxGeometry args={[0.84, 1.05, 0.62]} />
        <EnvironmentMaterial color="#17444e" roughness={0.82} metalness={0.18} />
      </mesh>
      <mesh position={[4.8, 0.62, 3.45]} rotation={[-0.05, -0.34, 0.08]}>
        <boxGeometry args={[0.76, 1.2, 0.62]} />
        <EnvironmentMaterial color="#194c55" roughness={0.82} metalness={0.18} />
      </mesh>

      <mesh position={[-4.3, 1.72, -2.9]}>
        <sphereGeometry args={[0.1, 8, 5]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.38} depthWrite={false} />
      </mesh>
      <mesh position={[4.35, 2.1, -2.45]}>
        <sphereGeometry args={[0.14, 8, 5]} />
        <meshBasicMaterial color="#65ffc7" transparent opacity={0.34} depthWrite={false} />
      </mesh>
      <mesh position={[5.2, 2.7, -1.6]}>
        <sphereGeometry args={[0.08, 8, 5]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Theme lighting and perimeter dressing. The center remains clear for the 4x4 board. */
export function ThemeEnvironment({ themeId }: ThemeEnvironmentProps) {
  const theme = THEMES[themeId];

  return (
    <>
      <fog attach="fog" args={[theme.fog, themeId === "sky" ? 8 : 6, themeId === "sky" ? 25 : 21]} />
      <ambientLight
        color={themeId === "lunar" ? "#9aa9d5" : themeId === "sky" ? "#fff4df" : "#75c8d5"}
        intensity={themeId === "sky" ? 1.25 : 0.9}
      />
      <hemisphereLight
        args={[
          themeId === "sky" ? "#e7f6f8" : themeId === "lunar" ? "#6172a1" : "#176276",
          theme.board,
          themeId === "sky" ? 0.72 : 0.5,
        ]}
      />
      <directionalLight
        position={themeId === "abyss" ? [-4, 7, 4] : [4, 8, 3]}
        color={themeId === "sky" ? "#fff1d2" : theme.accent}
        intensity={themeId === "sky" ? 1.35 : 1.1}
        castShadow={false}
      />

      <mesh position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22, 22]} />
        <EnvironmentMaterial
          color={theme.background}
          roughness={themeId === "sky" ? 1 : 0.92}
          metalness={themeId === "lunar" ? 0.12 : 0.02}
        />
      </mesh>

      {themeId === "lunar" ? <LunarEnvironment /> : null}
      {themeId === "sky" ? <SkyEnvironment /> : null}
      {themeId === "abyss" ? <AbyssEnvironment /> : null}
    </>
  );
}

