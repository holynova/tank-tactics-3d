"use client";

import { Float, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { PlayerColor, ThemeId } from "../../game/types";
import { THEMES } from "../../game/themes";
import * as THREE from "three";

export interface GameUnitProps {
  themeId: ThemeId;
  color: PlayerColor;
  selected: boolean;
  disabled?: boolean;
  variant?: number;
  aimAngle?: number;
  firing?: boolean;
}

interface UnitPalette {
  body: string;
  trim: string;
  accent: string;
  glass: string;
  selected: boolean;
  disabled: boolean;
}

const MODEL_ROOT = `${import.meta.env.BASE_URL}models/`;
const TANK_MODEL = `${MODEL_ROOT}main-battle-tank.glb`;
const SPG_MODEL = `${MODEL_ROOT}self-propelled-gun.glb`;
const TRACK_GEOMETRY = new THREE.BoxGeometry(0.16, 0.16, 0.88);
const ROLLER_GEOMETRY = new THREE.CylinderGeometry(0.073, 0.073, 0.065, 10);
const SHOULDER_GEOMETRY = new THREE.BoxGeometry(0.12, 0.11, 0.64);
const UNIT_MARKER_GEOMETRY = new THREE.BoxGeometry(0.065, 0.045, 0.04);
const PLOW_GEOMETRY = new THREE.BoxGeometry(0.72, 0.105, 0.15);

function addStaticInstances(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: Array<{ position: THREE.Vector3; rotation?: THREE.Euler }>,
) {
  const instances = new THREE.InstancedMesh(geometry, material, transforms.length);
  const object = new THREE.Object3D();
  transforms.forEach(({ position, rotation }, index) => {
    object.position.copy(position);
    object.rotation.copy(rotation ?? new THREE.Euler());
    object.updateMatrix();
    instances.setMatrixAt(index, object.matrix);
  });
  instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  instances.castShadow = true;
  instances.receiveShadow = true;
  parent.add(instances);
  return instances;
}

function getPalette(themeId: ThemeId, color: PlayerColor, selected: boolean, disabled: boolean): UnitPalette {
  const theme = THEMES[themeId];
  return {
    body: color === "red" ? theme.red : theme.blue,
    trim: themeId === "lunar" ? "#18202c" : themeId === "sky" ? "#242b38" : "#192530",
    accent: theme.accent,
    glass: color === "red" ? "#ffca75" : "#7cecff",
    selected: selected && !disabled,
    disabled,
  };
}

function SelectionFeedback({ palette }: { palette: UnitPalette }) {
  if (!palette.selected) return null;
  return (
    <group>
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.53, 48]} />
        <meshBasicMaterial
          color={palette.accent}
          transparent
          opacity={0.95}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.59, 0.605, 48]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

function recolorAsset(scene: THREE.Group, palette: UnitPalette, model: string) {
  const clone = scene.clone(true);
  const ownedMaterials = new Set<THREE.Material>();
  const modelRoot = clone.children.find((child) => child.name === model) ?? clone;

  // The source models expose turret parts as named, separate GLTF nodes. Gather
  // those pieces around their native pivot so the barrel can traverse to aim.
  const pivot = new THREE.Group();
  pivot.name = "animated-cannon-turret";
  pivot.position.set(0, model === "main-battle-tank" ? 2.09 : 2.08, 0);
  const turretParts = modelRoot.children.filter((child) => child.name === "turret");
  for (const part of turretParts) {
    part.position.sub(pivot.position);
    modelRoot.remove(part);
    pivot.add(part);
  }
  if (turretParts.length) modelRoot.add(pivot);

  const bounds = new THREE.Box3().setFromObject(clone);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 1.17 / Math.max(size.z, 0.001);
  clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);

  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const tintMaterial = (source: THREE.Material) => {
      const material = source.clone();
      ownedMaterials.add(material);
      if (material instanceof THREE.MeshStandardMaterial) {
        if (material.name === "olive") material.color.lerp(new THREE.Color(palette.body), 0.78);
        else if (material.name === "oliveDark") material.color.lerp(new THREE.Color(palette.body), 0.26);
        else if (material.name === "steel") material.color.lerp(new THREE.Color(palette.trim), 0.1);
        if (palette.selected && (material.name === "olive" || material.name === "oliveDark")) {
          material.emissive.set(palette.accent);
          material.emissiveIntensity = 0.14;
        }
        if (palette.disabled) {
          material.transparent = true;
          material.opacity = 0.3;
          material.depthWrite = false;
        }
      }
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(tintMaterial)
      : tintMaterial(object.material);
  });

  const normalized = new THREE.Group();
  normalized.add(clone);
  const trackMaterial = new THREE.MeshStandardMaterial({ color: palette.trim, metalness: 0.78, roughness: 0.46 });
  ownedMaterials.add(trackMaterial);
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(TRACK_GEOMETRY, trackMaterial);
    track.position.set(side * 0.32, 0.095, -0.015);
    track.castShadow = true;
    normalized.add(track);
  }
  const rollerMaterial = new THREE.MeshStandardMaterial({ color: palette.body, metalness: 0.72, roughness: 0.34 });
  ownedMaterials.add(rollerMaterial);
  addStaticInstances(
    normalized,
    ROLLER_GEOMETRY,
    rollerMaterial,
    [-1, 1].flatMap((side) => [-0.34, -0.12, 0.12, 0.34].map((z) => ({
      position: new THREE.Vector3(side * 0.405, 0.09, z),
      rotation: new THREE.Euler(0, 0, Math.PI / 2),
    }))),
  );
  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: palette.body, metalness: 0.64, roughness: 0.38 });
  ownedMaterials.add(shoulderMaterial);
  addStaticInstances(
    normalized,
    SHOULDER_GEOMETRY,
    shoulderMaterial,
    [-1, 1].map((side) => ({ position: new THREE.Vector3(side * 0.31, 0.245, -0.04) })),
  );
  const markerMaterial = new THREE.MeshBasicMaterial({ color: palette.accent, toneMapped: false });
  ownedMaterials.add(markerMaterial);
  addStaticInstances(
    normalized,
    UNIT_MARKER_GEOMETRY,
    markerMaterial,
    [-1, 1].map((side) => ({ position: new THREE.Vector3(side * 0.31, 0.252, 0.27) })),
  );
  const plowMaterial = new THREE.MeshStandardMaterial({ color: palette.trim, metalness: 0.76, roughness: 0.43 });
  ownedMaterials.add(plowMaterial);
  const plow = new THREE.Mesh(PLOW_GEOMETRY, plowMaterial);
  plow.position.set(0, 0.09, 0.52);
  plow.castShadow = true;
  normalized.add(plow);
  normalized.userData.ownedMaterials = [...ownedMaterials];
  normalized.scale.setScalar(scale);
  return normalized;
}

function ImportedArtillery({
  model,
  modelName,
  palette,
  aimAngle,
  firing,
}: {
  model: string;
  modelName: string;
  palette: UnitPalette;
  aimAngle: number;
  firing: boolean;
}) {
  const { scene } = useGLTF(model);
  const vehicle = useMemo(
    () => recolorAsset(scene, palette, modelName),
    [modelName, palette, scene],
  );
  useEffect(() => () => {
    const materials = vehicle.userData.ownedMaterials as THREE.Material[] | undefined;
    materials?.forEach((material) => material.dispose());
  }, [vehicle]);
  const root = useRef<THREE.Group>(null);
  const firedAt = useRef(0);
  const wasFiring = useRef(false);

  useFrame(({ clock }, delta) => {
    if (firing && !wasFiring.current) firedAt.current = clock.elapsedTime;
    wasFiring.current = firing;
    const recoilTime = clock.elapsedTime - firedAt.current;
    const recoil = firing && recoilTime >= 0 ? Math.sin(recoilTime * 46) * Math.exp(-recoilTime * 17) : 0;
    if (root.current) {
      root.current.position.z = -recoil * 0.075;
      root.current.rotation.x = -recoil * 0.025;
    }
    const turret = vehicle.getObjectByName("animated-cannon-turret");
    if (turret) turret.rotation.y = THREE.MathUtils.damp(turret.rotation.y, aimAngle, 13, delta);
  });

  return (
    <group ref={root}>
      <primitive object={vehicle} dispose={null} />
    </group>
  );
}

function WalkerCannon({ palette, aimAngle, firing, variant }: {
  palette: UnitPalette;
  aimAngle: number;
  firing: boolean;
  variant: number;
}) {
  const turret = useRef<THREE.Group>(null);
  const cannon = useRef<THREE.Group>(null);
  const firedAt = useRef(0);
  const wasFiring = useRef(false);
  const trackWheels = Array.from({ length: 5 }, (_, index) => -0.35 + index * 0.175);

  useFrame(({ clock }, delta) => {
    if (firing && !wasFiring.current) firedAt.current = clock.elapsedTime;
    wasFiring.current = firing;
    if (turret.current) turret.current.rotation.y = THREE.MathUtils.damp(turret.current.rotation.y, aimAngle, 13, delta);
    const elapsed = clock.elapsedTime - firedAt.current;
    const recoil = firing && elapsed >= 0 ? Math.sin(elapsed * 46) * Math.exp(-elapsed * 17) : 0;
    if (cannon.current) cannon.current.position.z = -recoil * 0.09;
  });

  return (
    <group>
      <mesh position={[0, 0.19, 0]} castShadow>
        <boxGeometry args={[0.86, 0.2, 0.95]} />
        <meshStandardMaterial color={palette.body} roughness={0.4} metalness={0.74} />
      </mesh>
      <mesh position={[0, 0.12, 0.38]} rotation={[0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.92, 0.16, 0.24]} />
        <meshStandardMaterial color={palette.trim} roughness={0.44} metalness={0.7} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.48, 0.12, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.15, 0.32, 1.06]} />
            <meshStandardMaterial color={palette.trim} roughness={0.74} metalness={0.58} />
          </mesh>
          {trackWheels.map((z, index) => (
            <mesh key={z} position={[side * 0.09, 0, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[index === 2 ? 0.115 : 0.095, index === 2 ? 0.115 : 0.095, 0.045, 10]} />
              <meshStandardMaterial color={index % 2 ? palette.body : "#111820"} metalness={0.72} roughness={0.34} />
            </mesh>
          ))}
        </group>
      ))}

      <mesh position={[0, 0.35, -0.02]} castShadow>
        <boxGeometry args={[0.52, 0.28, 0.57]} />
        <meshStandardMaterial color={palette.trim} roughness={0.38} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.48, 0.15]} rotation={[-0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.72, 0.12, 0.38]} />
        <meshStandardMaterial color={palette.body} roughness={0.36} metalness={0.78} />
      </mesh>
      <mesh position={[0, 0.53, 0.37]}>
        <boxGeometry args={[0.34, 0.07, 0.025]} />
        <meshBasicMaterial color={palette.glass} toneMapped={false} />
      </mesh>

      <group ref={turret} position={[0, 0.55, 0.02]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.25, 0.28, 0.18, 10]} />
          <meshStandardMaterial color={palette.trim} metalness={0.8} roughness={0.35} />
        </mesh>
        <group ref={cannon} position={[0, 0.01, 0.25]} rotation={[variant ? 0.025 : -0.015, 0, 0]}>
          <mesh position={[0, 0, 0.33]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 0.72, 10]} />
            <meshStandardMaterial color={palette.body} metalness={0.82} roughness={0.29} />
          </mesh>
          <mesh position={[0, 0, 0.69]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.09, 10]} />
            <meshStandardMaterial color={palette.trim} metalness={0.82} roughness={0.28} />
          </mesh>
        </group>
        <mesh position={[0.22, 0.1, -0.04]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color={palette.glass} toneMapped={false} />
        </mesh>
        <mesh position={[-0.19, 0.22, -0.05]} rotation={[0, 0, -0.16]}>
          <cylinderGeometry args={[0.012, 0.012, 0.33, 6]} />
          <meshStandardMaterial color="#c6d1d8" metalness={0.84} roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[0.24, 0.53, 0.18]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color={palette.glass} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Visual-only unit family selection; the controller continues to own all rules. */
export function GameUnit({
  themeId,
  color,
  selected,
  disabled = false,
  variant = 0,
  aimAngle = 0,
  firing = false,
}: GameUnitProps) {
  const palette = useMemo(
    () => getPalette(themeId, color, selected, disabled),
    [themeId, color, selected, disabled],
  );
  const useWalker = themeId === "abyss";
  const artilleryModel = themeId === "sky"
    ? variant % 2 === 0 ? SPG_MODEL : TANK_MODEL
    : variant % 2 === 0 ? TANK_MODEL : SPG_MODEL;
  const modelName = artilleryModel === TANK_MODEL ? "main-battle-tank" : "self-propelled-gun";

  return (
    <Float
      enabled={palette.selected}
      speed={0.8}
      rotationIntensity={0.025}
      floatIntensity={0.08}
      floatingRange={[-0.025, 0.025]}
    >
      <group>
        {useWalker ? (
          <WalkerCannon palette={palette} aimAngle={aimAngle} firing={firing} variant={variant} />
        ) : (
          <ImportedArtillery
            model={artilleryModel}
            modelName={modelName}
            palette={palette}
            aimAngle={aimAngle}
            firing={firing}
          />
        )}
        <SelectionFeedback palette={palette} />
      </group>
    </Float>
  );
}

useGLTF.preload(TANK_MODEL);
useGLTF.preload(SPG_MODEL);
