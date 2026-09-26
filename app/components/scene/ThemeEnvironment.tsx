"use client";

import { Stars } from "@react-three/drei";
import type { ThemeId } from "../../game/types";
import { THEMES } from "../../game/themes";

export interface ThemeEnvironmentProps {
  themeId: ThemeId;
}

function LunarEnvironment() {
  return (
    <group>
      <mesh position={[-4.65, -0.405, -3.55]} rotation={[-Math.PI / 2, 0.18, 0]}>
        <ringGeometry args={[0.58, 0.83, 28]} />
        <meshStandardMaterial color="#303847" roughness={0.98} metalness={0.04} />
      </mesh>
      <mesh position={[4.65, -0.405, 3.75]} rotation={[-Math.PI / 2, -0.3, 0]}>
        <ringGeometry args={[0.46, 0.67, 24]} />
        <meshStandardMaterial color="#252f3d" roughness={1} />
      </mesh>
      <mesh position={[-4.62, -0.32, -3.52]} rotation={[0.12, 0.1, -0.14]}>
        <dodecahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial color="#384353" roughness={0.96} />
      </mesh>
      <mesh position={[4.52, -0.28, 3.68]} rotation={[-0.12, -0.4, 0.18]}>
        <icosahedronGeometry args={[0.72, 1]} />
        <meshStandardMaterial color="#3b4759" roughness={0.96} />
      </mesh>

      {/* Raised trench walls bracket the battery without taking up board cells. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 3.82, -0.02, 0]}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.25, 0.58, 6.7]} />
            <meshStandardMaterial color="#38404e" roughness={0.85} metalness={0.34} />
          </mesh>
          <mesh position={[-side * 0.045, 0.43, 0]}>
            <boxGeometry args={[0.3, 0.055, 6.75]} />
            <meshStandardMaterial color="#8a7561" roughness={0.72} metalness={0.4} />
          </mesh>
          <mesh position={[-side * 0.16, 0.04, 0]}>
            <boxGeometry args={[0.12, 0.12, 6.1]} />
            <meshBasicMaterial color={side < 0 ? "#ff7548" : "#52c9ef"} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0, -4.85]} rotation={[0.08, 0.12, 0]}>
        <mesh position={[0, 1.25, 0]}>
          <cylinderGeometry args={[0.16, 0.3, 2.5, 7]} />
          <meshStandardMaterial color="#444f61" metalness={0.58} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.56, 0.035, 7, 24]} />
          <meshStandardMaterial color="#69788f" metalness={0.72} roughness={0.32} />
        </mesh>
        <mesh position={[0.32, 2.55, 0]}>
          <sphereGeometry args={[0.09, 9, 7]} />
          <meshBasicMaterial color="#ffbd62" toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[4.9, 1.05, -4.4]} rotation={[0.12, 0, 0.24]}>
        <coneGeometry args={[0.43, 1.8, 7]} />
        <meshStandardMaterial color="#333e4f" metalness={0.5} roughness={0.56} />
      </mesh>
      <mesh position={[-5.1, 0.75, 4.2]} rotation={[-0.1, 0, -0.18]}>
        <dodecahedronGeometry args={[0.68, 0]} />
        <meshStandardMaterial color="#353f50" roughness={0.94} />
      </mesh>
      <mesh position={[0, 3.7, -7.3]} rotation={[0.2, 0.05, 0]}>
        <torusGeometry args={[1.85, 0.032, 6, 52]} />
        <meshBasicMaterial color="#8e9bb4" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ForgeEnvironment() {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 4.45, 0, side < 0 ? -3.2 : 3.25]} rotation={[0, side * 0.18, side * 0.07]}>
          <mesh position={[0, 0.76, 0]} castShadow>
            <boxGeometry args={[0.62, 1.48, 0.68]} />
            <meshStandardMaterial color="#303e4c" roughness={0.5} metalness={0.7} />
          </mesh>
          <mesh position={[0, 1.54, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.37, 0.045, 7, 20]} />
            <meshStandardMaterial color="#97a5ae" roughness={0.33} metalness={0.84} />
          </mesh>
          <mesh position={[0, 0.96, 0.36]}>
            <boxGeometry args={[0.23, 0.08, 0.025]} />
            <meshBasicMaterial color={side < 0 ? "#ff865e" : "#64e0f3"} toneMapped={false} />
          </mesh>
          <group position={[side * 0.88, 0.95, 0.06]} rotation={[0.25, 0.12, side * -0.12]}>
            <mesh>
              <boxGeometry args={[1.65, 0.075, 0.92]} />
              <meshStandardMaterial color="#4b5c69" roughness={0.52} metalness={0.76} />
            </mesh>
            {[-0.7, -0.35, 0, 0.35, 0.7].map((x) => (
              <mesh key={x} position={[x, 0.055, 0]}>
                <boxGeometry args={[0.025, 0.018, 0.91]} />
                <meshBasicMaterial color="#61aac0" toneMapped={false} />
              </mesh>
            ))}
            <mesh position={[side * -0.1, -0.24, 0]}>
              <cylinderGeometry args={[0.025, 0.04, 0.5, 7]} />
              <meshStandardMaterial color="#8799a7" metalness={0.82} roughness={0.32} />
            </mesh>
          </group>
        </group>
      ))}
      <group position={[0, 4.5, -5.2]} rotation={[0.4, 0, 0.12]}>
        <mesh>
          <torusGeometry args={[2.05, 0.055, 7, 56]} />
          <meshStandardMaterial color="#647787" metalness={0.76} roughness={0.35} />
        </mesh>
        <mesh rotation={[0, 0.45, 0]}>
          <torusGeometry args={[2.12, 0.018, 5, 56]} />
          <meshBasicMaterial color="#ffbd62" transparent opacity={0.7} depthWrite={false} />
        </mesh>
        <mesh position={[1.87, 0, 0]}>
          <boxGeometry args={[0.54, 0.27, 0.32]} />
          <meshStandardMaterial color="#394755" metalness={0.78} roughness={0.42} />
        </mesh>
      </group>
      <mesh position={[-5.1, 0.28, 4.5]} rotation={[0.36, 0.4, -0.7]}>
        <boxGeometry args={[1.25, 0.16, 0.42]} />
        <meshStandardMaterial color="#465764" metalness={0.8} roughness={0.52} />
      </mesh>
      <mesh position={[5.15, 0.42, -4.25]} rotation={[-0.34, -0.24, 0.4]}>
        <boxGeometry args={[1.3, 0.18, 0.56]} />
        <meshStandardMaterial color="#41505c" metalness={0.78} roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.5, -7.2]} rotation={[Math.PI / 2, 0.2, 0]}>
        <torusGeometry args={[2.45, 0.04, 7, 52]} />
        <meshBasicMaterial color="#6f8795" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

function IceRingEnvironment() {
  const crystals = [
    [-4.6, -3.45, 0.9, -0.2], [-5.0, -2.5, 1.35, 0.16], [4.65, -3.6, 1.15, 0.2],
    [5.0, -2.65, 0.9, -0.18], [-4.8, 3.35, 1.25, 0.14], [4.7, 3.6, 1.55, -0.16],
  ] as const;
  return (
    <group>
      {crystals.map(([x, z, height, lean], index) => (
        <group key={index} position={[x, 0, z]} rotation={[0, lean, 0]}>
          <mesh position={[0, height * 0.46, 0]} rotation={[lean * 0.4, 0.2, lean]} castShadow>
            <coneGeometry args={[0.48 + index % 2 * 0.12, height, 6]} />
            <meshStandardMaterial color={index % 2 ? "#477181" : "#3b6979"} roughness={0.22} metalness={0.42} transparent opacity={0.86} />
          </mesh>
          <mesh position={[0, height * 0.52, 0.04]}>
            <coneGeometry args={[0.17, height * 0.76, 5]} />
            <meshBasicMaterial color="#b9f5ff" transparent opacity={0.18} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 4.5, 0.08, side * 2.7]} rotation={[0, side * 0.22, side * 0.05]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.68, 0.8, 0.72]} />
            <meshStandardMaterial color="#263b48" roughness={0.42} metalness={0.72} />
          </mesh>
          <mesh position={[side * -0.34, 0.41, 0]}>
            <boxGeometry args={[0.06, 0.82, 0.74]} />
            <meshBasicMaterial color={side < 0 ? "#ff765d" : "#71dcf3"} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.86, 0]} rotation={[0.12, 0, Math.PI / 2]}>
            <torusGeometry args={[0.25, 0.035, 6, 18]} />
            <meshStandardMaterial color="#93adb9" metalness={0.72} roughness={0.32} />
          </mesh>
        </group>
      ))}
      <group position={[0.15, 4.2, -6.1]} rotation={[0.2, 0.1, 0.7]}>
        <mesh>
          <torusGeometry args={[1.9, 0.045, 7, 48]} />
          <meshStandardMaterial color="#547483" metalness={0.62} roughness={0.32} />
        </mesh>
        <mesh rotation={[0, 0, 0.5]}>
          <torusGeometry args={[1.96, 0.016, 5, 48]} />
          <meshBasicMaterial color="#94e8f5" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>
      <mesh position={[-5.3, 0.42, 4.2]} rotation={[0.4, -0.1, 0.7]}>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color="#283f4c" roughness={0.58} metalness={0.42} />
      </mesh>
      <mesh position={[5.1, 0.32, -4.6]} rotation={[-0.2, 0.2, 0.46]}>
        <icosahedronGeometry args={[0.65, 0]} />
        <meshStandardMaterial color="#304b59" roughness={0.55} metalness={0.46} />
      </mesh>
    </group>
  );
}

/** A shared, high-angle artillery platform with three locations in the same orbital war. */
export function ThemeEnvironment({ themeId }: ThemeEnvironmentProps) {
  const theme = THEMES[themeId];

  return (
    <>
      <fog attach="fog" args={[theme.fog, 8, 27]} />
      <Stars radius={38} depth={15} count={460} factor={2.4} saturation={0.28} fade speed={0.1} />
      <ambientLight color="#c4d2e4" intensity={1.08} />
      <hemisphereLight args={["#b1c7db", theme.board, 0.92]} />
      <directionalLight position={[5, 11, 4]} color="#f0f5ff" intensity={2.1} />
      <directionalLight position={[-5, 6, -4]} color={theme.accent} intensity={1.1} />
      <pointLight position={[-4.3, 2.8, -0.6]} color={theme.red} intensity={10} distance={8} decay={2} />
      <pointLight position={[4.3, 2.6, 0.8]} color={theme.blue} intensity={10} distance={8} decay={2} />

      <mesh position={[0, -0.44, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial color={theme.background} roughness={0.93} metalness={0.15} />
      </mesh>

      {themeId === "lunar" ? <LunarEnvironment /> : null}
      {themeId === "sky" ? <ForgeEnvironment /> : null}
      {themeId === "abyss" ? <IceRingEnvironment /> : null}
    </>
  );
}
