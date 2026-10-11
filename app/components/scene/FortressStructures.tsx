"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getMarkTexture, getSurfaceTextures } from "./industrial-materials";

type GeometryBucket = "armor" | "dark" | "trim" | "light";

type GeometrySet = {
  armor: THREE.BufferGeometry;
  dark: THREE.BufferGeometry;
  trim: THREE.BufferGeometry;
  light: THREE.BufferGeometry;
  decalPosition: [number, number, number];
};

type GeometryParts = Record<GeometryBucket, THREE.BufferGeometry[]>;

export interface FortressStructureProps {
  position: [number, number, number];
  scale?: number;
  variant?: number;
}

const geometryCache = new Map<number, GeometrySet>();
const decalGeometry = new THREE.PlaneGeometry(0.31, 0.15);
const variantMarks = ["07", "12", "03"] as const;

function addGeometry(
  parts: GeometryParts,
  bucket: GeometryBucket,
  geometry: THREE.BufferGeometry,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const transform = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(1, 1, 1),
  );
  geometry.applyMatrix4(transform);
  parts[bucket].push(geometry);
}

function addBox(
  parts: GeometryParts,
  bucket: GeometryBucket,
  dimensions: [number, number, number],
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  addGeometry(parts, bucket, new THREE.BoxGeometry(...dimensions), position, rotation);
}

function addCylinder(
  parts: GeometryParts,
  bucket: GeometryBucket,
  radiusTop: number,
  radiusBottom: number,
  length: number,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  radialSegments = 8,
) {
  addGeometry(parts, bucket, new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radialSegments), position, rotation);
}

function addFrontBolt(parts: GeometryParts, x: number, y: number, z: number) {
  addCylinder(parts, "trim", 0.025, 0.025, 0.018, [x, y, z], [Math.PI / 2, 0, 0], 8);
}

function createParts(): GeometryParts {
  return { armor: [], dark: [], trim: [], light: [] };
}

function mergeBucket(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  parts.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error("FortressStructure geometry could not be merged.");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function buildGeometrySet(variant: number): GeometrySet {
  const parts = createParts();
  const height = 1.1 + variant * 0.7;
  const bodyBottom = 0.29;
  const bodyHeight = height - bodyBottom;
  const bodyCenter = bodyBottom + bodyHeight * 0.5;
  const frontZ = 0.372;

  // A layered footing gives the tower a broad, anchored silhouette.
  addBox(parts, "dark", [1.2, 0.055, 0.92], [0, 0.035, 0]);
  addBox(parts, "armor", [1.16, 0.13, 0.88], [0, 0.115, 0]);
  addBox(parts, "trim", [1.08, 0.035, 0.82], [0, 0.2, 0]);
  addBox(parts, "armor", [1.01, 0.13, 0.77], [0, 0.274, 0]);

  // The armored core sits above the plinth, with articulated sloped front plates.
  addBox(parts, "armor", [0.92, bodyHeight, 0.68], [0, bodyCenter, 0]);
  addBox(parts, "armor", [0.31, bodyHeight * 0.76, 0.09], [-0.265, bodyCenter, frontZ], [0, 0, 0.14]);
  addBox(parts, "armor", [0.31, bodyHeight * 0.76, 0.09], [0.265, bodyCenter, frontZ], [0, 0, -0.14]);

  // Raised corner ribs and four horizontal armor courses break up the broad faces.
  for (const x of [-0.445, 0.445]) {
    for (const z of [-0.302, 0.302]) {
      addBox(parts, "trim", [0.075, bodyHeight * 0.91, 0.084], [x, bodyCenter, z]);
    }
  }
  for (let index = 1; index <= 4; index += 1) {
    const y = bodyBottom + bodyHeight * index / 5;
    addBox(parts, "trim", [0.96, 0.034, 0.045], [0, y, 0.365]);
    addBox(parts, "dark", [0.96, 0.025, 0.035], [0, y - 0.03, 0.37]);
    addBox(parts, "trim", [0.96, 0.034, 0.045], [0, y, -0.365]);
    addBox(parts, "trim", [0.045, 0.034, 0.72], [0.475, y, 0]);
    addBox(parts, "trim", [0.045, 0.034, 0.72], [-0.475, y, 0]);
  }

  // Front access panel, deep ventilation slots, and warm armored vision slits.
  addBox(parts, "dark", [0.43, 0.15, 0.035], [0, 0.405, 0.411]);
  for (let index = 0; index < 5; index += 1) {
    addBox(parts, "trim", [0.034, 0.091, 0.016], [-0.15 + index * 0.075, 0.405, 0.435]);
  }
  for (const x of [-0.31, -0.155, 0, 0.155, 0.31]) {
    addBox(parts, "dark", [0.095, 0.062, 0.026], [x, height * 0.79, 0.39]);
    addBox(parts, "light", [0.061, 0.022, 0.012], [x, height * 0.79, 0.411]);
  }
  addBox(parts, "dark", [0.1, 0.055, 0.026], [0, height * 0.67, 0.397]);
  addBox(parts, "light", [0.064, 0.018, 0.012], [0, height * 0.67, 0.417]);

  // Small captive bolts are concentrated on the removable front armor panels.
  for (const x of [-0.39, -0.16, 0.16, 0.39]) {
    addFrontBolt(parts, x, 0.34, 0.43);
    addFrontBolt(parts, x, height - 0.1, 0.43);
  }

  // Service ladder on the left flank, built from shared rails and individual rungs.
  const ladderBottom = 0.34;
  const ladderHeight = bodyHeight * 0.72;
  for (const z of [-0.12, 0.12]) {
    addCylinder(parts, "dark", 0.014, 0.014, ladderHeight, [-0.49, ladderBottom + ladderHeight / 2, z], [0, 0, 0], 7);
    addCylinder(parts, "trim", 0.018, 0.018, 0.035, [-0.49, ladderBottom, z], [0, 0, 0], 7);
    addCylinder(parts, "trim", 0.018, 0.018, 0.035, [-0.49, ladderBottom + ladderHeight, z], [0, 0, 0], 7);
  }
  for (let index = 0; index < 7; index += 1) {
    const y = ladderBottom + 0.07 + index * ladderHeight / 7;
    addBox(parts, "trim", [0.035, 0.022, 0.26], [-0.49, y, 0]);
  }

  // Paired coolant lines and clamp collars run down the opposite flank.
  for (const z of [-0.2, 0.16]) {
    addCylinder(parts, "dark", 0.025, 0.028, bodyHeight * 0.78, [0.494, bodyBottom + bodyHeight * 0.47, z], [0, 0, Math.PI / 2], 8);
    for (const ratio of [0.18, 0.51, 0.82]) {
      addCylinder(parts, "trim", 0.038, 0.038, 0.035, [0.515, bodyBottom + bodyHeight * ratio, z], [0, 0, Math.PI / 2], 8);
    }
  }

  // Roof armor and access hatch.
  addBox(parts, "dark", [1.02, 0.055, 0.79], [0, height + 0.025, 0]);
  addBox(parts, "armor", [0.98, 0.11, 0.75], [0, height + 0.095, 0]);
  addBox(parts, "trim", [0.48, 0.025, 0.36], [0.12, height + 0.16, 0.025]);
  addBox(parts, "dark", [0.38, 0.019, 0.26], [0.12, height + 0.18, 0.025]);
  for (const x of [-0.39, 0.39]) {
    addBox(parts, "trim", [0.035, 0.16, 0.035], [x, height + 0.19, 0.28]);
    addBox(parts, "trim", [0.035, 0.16, 0.035], [x, height + 0.19, -0.28]);
  }
  addBox(parts, "trim", [0.82, 0.035, 0.035], [0, height + 0.27, 0.28]);
  addBox(parts, "trim", [0.82, 0.035, 0.035], [0, height + 0.27, -0.28]);

  if (variant === 2) {
    // Variant two rises into a stepped command crown with inset vision ports.
    addBox(parts, "dark", [0.9, 0.04, 0.67], [0, height + 0.18, 0]);
    addBox(parts, "armor", [0.83, 0.24, 0.62], [0, height + 0.31, 0]);
    addBox(parts, "trim", [0.88, 0.045, 0.66], [0, height + 0.45, 0]);
    addBox(parts, "armor", [0.62, 0.18, 0.48], [0, height + 0.56, 0]);
    addBox(parts, "trim", [0.68, 0.045, 0.53], [0, height + 0.67, 0]);
    for (const x of [-0.23, -0.08, 0.08, 0.23]) {
      addBox(parts, "dark", [0.09, 0.06, 0.025], [x, height + 0.31, 0.323]);
      addBox(parts, "light", [0.057, 0.02, 0.012], [x, height + 0.31, 0.344]);
    }
    for (const x of [-0.26, 0.26]) {
      addBox(parts, "trim", [0.045, 0.13, 0.045], [x, height + 0.73, 0.15]);
    }
  }

  // Two compact comms masts finish each roof without dominating the tower profile.
  const mastHeight = variant === 2 ? 0.42 : 0.34 + variant * 0.06;
  const mastBase = height + (variant === 2 ? 0.76 : 0.16);
  for (const [index, x] of [-0.29, 0.29].entries()) {
    const z = index === 0 ? -0.2 : 0.18;
    addCylinder(parts, "dark", 0.024, 0.035, 0.055, [x, mastBase, z], [0, 0, 0], 8);
    addCylinder(parts, "trim", 0.012, 0.017, mastHeight, [x, mastBase + mastHeight * 0.5, z], [0, 0, 0], 7);
    addCylinder(parts, "trim", 0.023, 0.023, 0.025, [x, mastBase + mastHeight, z], [0, 0, 0], 8);
    addBox(parts, "trim", [0.14, 0.018, 0.018], [x, mastBase + mastHeight * 0.78, z]);
  }
  addBox(parts, "dark", [0.11, 0.055, 0.16], [0, height + 0.18, -0.12]);
  addCylinder(parts, "trim", 0.045, 0.06, 0.09, [0, height + 0.245, -0.12], [0, 0, 0], 8);

  const decalPosition: [number, number, number] = [0, 0.57, 0.442];
  return {
    armor: mergeBucket(parts.armor),
    dark: mergeBucket(parts.dark),
    trim: mergeBucket(parts.trim),
    light: mergeBucket(parts.light),
    decalPosition,
  };
}

function getGeometrySet(variant: number): GeometrySet {
  const cached = geometryCache.get(variant);
  if (cached) return cached;
  const geometry = buildGeometrySet(variant);
  geometryCache.set(variant, geometry);
  return geometry;
}

function createMaterials() {
  const steel = getSurfaceTextures("steel");
  return {
    armor: new THREE.MeshStandardMaterial({
      ...steel,
      color: "#8a928d",
      metalness: 0.65,
      roughness: 0.7,
      bumpScale: 0.03,
    }),
    dark: new THREE.MeshStandardMaterial({
      ...steel,
      color: "#343b3a",
      metalness: 0.72,
      roughness: 0.78,
      bumpScale: 0.03,
    }),
    trim: new THREE.MeshStandardMaterial({
      ...steel,
      color: "#727a75",
      metalness: 0.76,
      roughness: 0.58,
      bumpScale: 0.03,
    }),
    light: new THREE.MeshStandardMaterial({
      color: "#e9a35f",
      emissive: "#ff8c3d",
      emissiveIntensity: 1.25,
      metalness: 0.2,
      roughness: 0.42,
    }),
  };
}

function normalizeVariant(variant: number | undefined): number {
  const integer = Math.trunc(variant ?? 0);
  return ((integer % 3) + 3) % 3;
}

/** A compact armored orbital bunker with three cached tower silhouettes. */
export function FortressStructure({ position, scale = 1, variant = 0 }: FortressStructureProps) {
  const shape = normalizeVariant(variant);
  const geometries = useMemo(() => getGeometrySet(shape), [shape]);
  const materials = useMemo(() => createMaterials(), []);
  const markTexture = useMemo(() => getMarkTexture(variantMarks[shape]), [shape]);
  const markMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: markTexture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  }), [markTexture]);

  useEffect(() => () => {
    materials.armor.dispose();
    materials.dark.dispose();
    materials.trim.dispose();
    materials.light.dispose();
    markMaterial.dispose();
  }, [materials, markMaterial]);

  return (
    <group position={position} scale={scale} dispose={null}>
      <mesh geometry={geometries.armor} material={materials.armor} castShadow receiveShadow />
      <mesh geometry={geometries.dark} material={materials.dark} castShadow receiveShadow />
      <mesh geometry={geometries.trim} material={materials.trim} castShadow receiveShadow />
      <mesh geometry={geometries.light} material={materials.light} castShadow receiveShadow />
      <mesh
        geometry={decalGeometry}
        material={markMaterial}
        position={geometries.decalPosition}
      />
    </group>
  );
}
