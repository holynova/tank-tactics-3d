import * as THREE from "three";

export type SurfaceKind = "steel" | "armor" | "deck" | "ground" | "hazard" | "planet";

type SurfaceTextures = {
  map: THREE.CanvasTexture;
  bumpMap?: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
};

type TextureLayers = {
  map: CanvasRenderingContext2D;
  bump: CanvasRenderingContext2D;
  roughness: CanvasRenderingContext2D;
};

type SurfaceProfile = {
  base: number;
  roughness: number;
  broad: number;
  medium: number;
  fine: number;
  grain: number;
  scratchCount: number;
};

const SURFACE_SIZE = 512;
const PLANET_SIZE = { width: 1024, height: 512 };
const MAX_MARK_CACHE_SIZE = 48;

const profiles: Record<SurfaceKind, SurfaceProfile> = {
  steel: { base: 170, roughness: 211, broad: 15, medium: 14, fine: 8, grain: 6, scratchCount: 115 },
  armor: { base: 190, roughness: 218, broad: 17, medium: 13, fine: 8, grain: 6, scratchCount: 92 },
  deck: { base: 160, roughness: 222, broad: 14, medium: 16, fine: 10, grain: 7, scratchCount: 145 },
  ground: { base: 158, roughness: 246, broad: 21, medium: 18, fine: 13, grain: 10, scratchCount: 24 },
  hazard: { base: 126, roughness: 228, broad: 13, medium: 13, fine: 8, grain: 8, scratchCount: 96 },
  planet: { base: 153, roughness: 239, broad: 19, medium: 17, fine: 10, grain: 7, scratchCount: 18 },
};

const surfaceTextureCache = new Map<SurfaceKind, SurfaceTextures>();
const markTextureCache = new Map<string, THREE.CanvasTexture>();

function hash32(value: number): number {
  let hash = value | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function hash2d(x: number, y: number, seed: number): number {
  return hash32(Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ seed) / 0xffffffff;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function stringSeed(value: string): number {
  let seed = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    seed = Math.imul(seed ^ value.charCodeAt(index), 0x01000193);
  }
  return seed >>> 0;
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

/** Precomputed periodic value noise gives the pixel field a clean repeat seam. */
function periodicNoise(width: number, height: number, cellSize: number, seed: number): (x: number, y: number) => number {
  const columns = Math.max(1, Math.round(width / cellSize));
  const rows = Math.max(1, Math.round(height / cellSize));
  const values = new Float32Array(columns * rows);
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < columns; gx += 1) {
      values[gy * columns + gx] = hash2d(gx, gy, seed) * 2 - 1;
    }
  }
  return (x: number, y: number) => {
    const gridX = x / cellSize;
    const gridY = y / cellSize;
    const x0 = Math.floor(gridX);
    const y0 = Math.floor(gridY);
    const x1 = (x0 + 1) % columns;
    const y1 = (y0 + 1) % rows;
    const u = smooth(gridX - x0);
    const v = smooth(gridY - y0);
    const top = values[y0 * columns + x0] * (1 - u) + values[y0 * columns + x1] * u;
    const bottom = values[y1 * columns + x0] * (1 - u) + values[y1 * columns + x1] * u;
    return top * (1 - v) + bottom * v;
  };
}

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Canvas 2D is required to build industrial surface textures.");
  context.imageSmoothingEnabled = true;
  return { canvas, context };
}

function canvasTexture(canvas: HTMLCanvasElement, colorTexture: boolean): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeLayers(width: number, height: number): { layers: TextureLayers; canvases: Record<keyof TextureLayers, HTMLCanvasElement> } {
  const map = makeCanvas(width, height);
  const bump = makeCanvas(width, height);
  const roughness = makeCanvas(width, height);
  return {
    layers: { map: map.context, bump: bump.context, roughness: roughness.context },
    canvases: { map: map.canvas, bump: bump.canvas, roughness: roughness.canvas },
  };
}

function setGray(image: ImageData, offset: number, value: number) {
  const channel = Math.max(0, Math.min(255, value)) | 0;
  image.data[offset] = channel;
  image.data[offset + 1] = channel;
  image.data[offset + 2] = channel;
  image.data[offset + 3] = 255;
}

function paintBaseNoise(
  layers: TextureLayers,
  width: number,
  height: number,
  profile: SurfaceProfile,
  seed: number,
  kind: SurfaceKind,
) {
  const mapImage = layers.map.createImageData(width, height);
  const bumpImage = layers.bump.createImageData(width, height);
  const roughImage = layers.roughness.createImageData(width, height);
  const broadNoise = periodicNoise(width, height, 128, seed + 11);
  const mediumNoise = periodicNoise(width, height, 32, seed + 23);
  const fineNoise = periodicNoise(width, height, 8, seed + 37);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const broad = broadNoise(x, y);
      const medium = mediumNoise(x, y);
      const fine = fineNoise(x, y);
      const grit = (hash2d(x % width, y % height, seed + 53) - 0.5) * 2;
      let mapValue = profile.base + broad * profile.broad + medium * profile.medium + fine * profile.fine + grit * profile.grain;
      let bumpValue = 128 + broad * 12 + medium * 22 + fine * 19 + grit * 18;
      let roughValue = profile.roughness + broad * 8 + medium * 14 + fine * 14 + grit * 10;

      if (kind === "hazard") {
        const stripe = (x + y) % 64;
        const painted = stripe < 31;
        const wornEdge = stripe === 30 || stripe === 31 || stripe === 62 || stripe === 63;
        const fleck = hash2d(x % width, y % height, seed + 91);
        if (painted) {
          mapValue += wornEdge ? -10 : fleck > 0.993 ? 20 : -60;
          bumpValue += wornEdge ? -5 : -12;
          roughValue += 6;
        } else {
          mapValue += fleck > 0.994 ? -12 : 32;
          bumpValue += 7;
          roughValue -= 13;
        }
      }

      const offset = (y * width + x) * 4;
      setGray(mapImage, offset, mapValue);
      setGray(bumpImage, offset, bumpValue);
      setGray(roughImage, offset, roughValue);
    }
  }

  layers.map.putImageData(mapImage, 0, 0);
  layers.bump.putImageData(bumpImage, 0, 0);
  layers.roughness.putImageData(roughImage, 0, 0);
}

function ellipse(context: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function drawScratches(layers: TextureLayers, width: number, height: number, profile: SurfaceProfile, seed: number, kind: SurfaceKind) {
  const random = seededRandom(seed ^ 0x6d2b79f5);
  const count = profile.scratchCount;
  const colors = {
    mapDark: kind === "ground" || kind === "planet" ? "rgba(37,37,37,0.30)" : "rgba(24,24,24,0.47)",
    mapLight: "rgba(226,226,220,0.38)",
    bumpDark: "rgba(48,48,48,0.66)",
    bumpLight: "rgba(205,205,205,0.55)",
    roughDark: "rgba(120,120,120,0.40)",
    roughLight: "rgba(248,248,248,0.28)",
  };

  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const length = kind === "ground" || kind === "planet" ? 3 + random() * 13 : 8 + random() * 88;
    const angle = random() * Math.PI * 2;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    const lineWidth = kind === "ground" || kind === "planet" ? 0.45 + random() * 0.65 : 0.55 + random() * 1.8;

    const bend = (random() - 0.5) * length * 0.11;
    const startX = x;
    const startY = y;
    const controlX = x + dx * 0.48 - dy * 0.05 + bend;
    const controlY = y + dy * 0.48 + dx * 0.05;
    const endX = x + dx;
    const endY = y + dy;
    const offsetsX = [0, ...(Math.min(startX, controlX, endX) < 0 ? [width] : []), ...(Math.max(startX, controlX, endX) >= width ? [-width] : [])];
    const offsetsY = [0, ...(Math.min(startY, controlY, endY) < 0 ? [height] : []), ...(Math.max(startY, controlY, endY) >= height ? [-height] : [])];
    const stroke = (context: CanvasRenderingContext2D, color: string, offsetX: number, offsetY: number, strokeWidth: number) => {
      context.beginPath();
      context.moveTo(x + offsetX, y + offsetY);
      context.quadraticCurveTo(x + dx * 0.48 - dy * 0.05 + bend + offsetX, y + dy * 0.48 + dx * 0.05 + offsetY, x + dx + offsetX, y + dy + offsetY);
      context.strokeStyle = color;
      context.lineWidth = strokeWidth;
      context.lineCap = "round";
      context.stroke();
    };

    for (const offsetX of offsetsX) {
      for (const offsetY of offsetsY) {
        stroke(layers.map, colors.mapDark, offsetX, offsetY, lineWidth + 0.45);
        stroke(layers.map, colors.mapLight, offsetX - 0.6, offsetY - 0.7, Math.max(0.35, lineWidth * 0.56));
        stroke(layers.bump, colors.bumpDark, offsetX, offsetY, lineWidth + 0.7);
        stroke(layers.bump, colors.bumpLight, offsetX - 0.65, offsetY - 0.65, Math.max(0.4, lineWidth * 0.48));
        stroke(layers.roughness, colors.roughDark, offsetX, offsetY, lineWidth + 0.2);
        stroke(layers.roughness, colors.roughLight, offsetX - 0.5, offsetY - 0.5, Math.max(0.4, lineWidth * 0.42));
      }
    }
  }
}

function drawEdgeChips(layers: TextureLayers, size: number, seed: number, count: number) {
  const random = seededRandom(seed ^ 0x3b49d1c3);
  for (let index = 0; index < count; index += 1) {
    const edge = Math.floor(random() * 4);
    const along = 18 + random() * (size - 36);
    const depth = 1.2 + random() * 7;
    let x = along;
    let y = depth;
    if (edge === 1) { x = size - depth; y = along; }
    else if (edge === 2) { x = along; y = size - depth; }
    else if (edge === 3) { x = depth; y = along; }
    const width = 1.2 + random() * 8;
    const pointCount = 3 + Math.floor(random() * 3);
    const points: Array<[number, number]> = [];
    for (let point = 0; point < pointCount; point += 1) {
      points.push([x + (random() - 0.5) * width, y + (random() - 0.5) * depth * 1.9]);
    }

    for (const [context, shadow, bright] of [
      [layers.map, "rgba(26,26,26,0.64)", "rgba(210,210,205,0.75)"],
      [layers.bump, "rgba(45,45,45,0.83)", "rgba(224,224,224,0.72)"],
      [layers.roughness, "rgba(245,245,245,0.62)", "rgba(116,116,116,0.56)"],
    ] as const) {
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (let point = 1; point < points.length; point += 1) context.lineTo(points[point][0], points[point][1]);
      context.closePath();
      context.fillStyle = shadow;
      context.fill();
      context.beginPath();
      context.moveTo(points[0][0] - 0.8, points[0][1] - 0.8);
      for (let point = 1; point < points.length; point += 1) context.lineTo(points[point][0] - 0.8, points[point][1] - 0.8);
      context.closePath();
      context.fillStyle = bright;
      context.fill();
    }
  }
}

function drawBolt(layers: TextureLayers, x: number, y: number, radius: number, rotation: number) {
  const paint = (
    context: CanvasRenderingContext2D,
    shadow: string,
    rim: string,
    face: string,
    slot: string,
    highlight: string,
  ) => {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    ellipse(context, 1.5, 2.3, radius * 1.28, radius * 1.28);
    context.fillStyle = shadow;
    context.fill();
    ellipse(context, 0, 0, radius * 1.18, radius * 1.18);
    context.fillStyle = rim;
    context.fill();
    ellipse(context, -0.25, -0.45, radius * 0.83, radius * 0.83);
    context.fillStyle = face;
    context.fill();
    context.beginPath();
    context.moveTo(-radius * 0.43, 0);
    context.lineTo(radius * 0.43, 0);
    context.strokeStyle = slot;
    context.lineWidth = Math.max(1, radius * 0.18);
    context.lineCap = "round";
    context.stroke();
    context.beginPath();
    context.moveTo(-radius * 0.4, -radius * 0.58);
    context.lineTo(radius * 0.18, -radius * 0.58);
    context.strokeStyle = highlight;
    context.lineWidth = Math.max(0.6, radius * 0.12);
    context.stroke();
    context.restore();
  };

  paint(layers.map, "rgba(18,18,18,0.8)", "#292929", "#888884", "#353535", "rgba(238,238,228,0.8)");
  paint(layers.bump, "rgba(42,42,42,0.9)", "#dedede", "#858585", "#343434", "rgba(238,238,238,0.75)");
  paint(layers.roughness, "rgba(255,255,255,0.68)", "#aaa", "#dfdfdf", "#888", "rgba(255,255,255,0.5)");
}

function drawDeckPlate(layers: TextureLayers, size: number, seed: number) {
  const drawFrame = (
    context: CanvasRenderingContext2D,
    outer: string,
    inner: string,
    fine: string,
    width: number,
  ) => {
    context.save();
    context.lineJoin = "round";
    context.strokeStyle = outer;
    context.lineWidth = width + 1.8;
    context.strokeRect(8, 8, size - 16, size - 16);
    context.strokeStyle = inner;
    context.lineWidth = width;
    context.strokeRect(12.5, 12.5, size - 25, size - 25);
    context.strokeStyle = fine;
    context.lineWidth = 1;
    context.strokeRect(21, 21, size - 42, size - 42);
    context.restore();
  };

  drawFrame(layers.map, "rgba(29,29,29,0.92)", "rgba(207,207,199,0.76)", "rgba(47,47,47,0.66)", 3.2);
  drawFrame(layers.bump, "rgba(42,42,42,0.95)", "rgba(225,225,225,0.92)", "rgba(73,73,73,0.82)", 3.4);
  drawFrame(layers.roughness, "rgba(255,255,255,0.76)", "rgba(130,130,130,0.78)", "rgba(245,245,245,0.55)", 3.1);

  // A second, shallow inset makes the face read as a thick, replaceable armor plate.
  for (const [context, color, width] of [
    [layers.map, "rgba(45,45,45,0.38)", 1.3],
    [layers.bump, "rgba(40,40,40,0.56)", 1.4],
    [layers.roughness, "rgba(255,255,255,0.42)", 1.2],
  ] as const) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.strokeRect(31, 31, size - 62, size - 62);
  }

  const inset = 30;
  for (const x of [inset, size - inset]) {
    for (const y of [inset, size - inset]) drawBolt(layers, x, y, 7.1, (x + y + seed % 9) * 0.01);
  }

  // Fine service-panel marks at the center and short index cuts near the rim.
  for (const [context, color, width] of [
    [layers.map, "rgba(49,49,49,0.38)", 1.1],
    [layers.bump, "rgba(40,40,40,0.42)", 1.4],
    [layers.roughness, "rgba(255,255,255,0.32)", 1],
  ] as const) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(size * 0.45, 26);
    context.lineTo(size * 0.55, 26);
    context.moveTo(size * 0.45, size - 26);
    context.lineTo(size * 0.55, size - 26);
    context.moveTo(26, size * 0.45);
    context.lineTo(26, size * 0.55);
    context.moveTo(size - 26, size * 0.45);
    context.lineTo(size - 26, size * 0.55);
    context.stroke();
    context.strokeRect(size * 0.5 - 15, size * 0.5 - 8, 30, 16);
    context.beginPath();
    context.moveTo(size * 0.5 - 7, size * 0.5);
    context.lineTo(size * 0.5 + 7, size * 0.5);
    context.stroke();
  }

  const random = seededRandom(seed ^ 0xa047fe51);
  for (let index = 0; index < 46; index += 1) {
    const x = 38 + random() * (size - 76);
    const y = 38 + random() * (size - 76);
    const radius = 1.3 + random() * 6.5;
    const angle = random() * Math.PI * 2;
    for (const [context, dark, light] of [
      [layers.map, "rgba(37,37,37,0.44)", "rgba(216,216,209,0.26)"],
      [layers.bump, "rgba(46,46,46,0.56)", "rgba(218,218,218,0.46)"],
      [layers.roughness, "rgba(250,250,250,0.28)", "rgba(125,125,125,0.2)"],
    ] as const) {
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      ellipse(context, 0, 0, radius * 1.5, radius);
      context.fillStyle = dark;
      context.fill();
      ellipse(context, -radius * 0.25, -radius * 0.32, radius * 0.96, radius * 0.48);
      context.fillStyle = light;
      context.fill();
      context.restore();
    }
  }
}

function drawArmorPanels(layers: TextureLayers, size: number, seed: number) {
  const inset = 24;
  const panelPaint = (context: CanvasRenderingContext2D, stroke: string, width: number) => {
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(inset + 18, inset);
    context.lineTo(size * 0.62, inset);
    context.lineTo(size * 0.68, inset + 8);
    context.lineTo(size - inset, inset + 8);
    context.lineTo(size - inset, size * 0.38);
    context.lineTo(size - inset - 12, size * 0.43);
    context.lineTo(size - inset - 12, size - inset);
    context.lineTo(size * 0.43, size - inset);
    context.lineTo(size * 0.38, size - inset - 10);
    context.lineTo(inset, size - inset - 10);
    context.lineTo(inset, size * 0.52);
    context.lineTo(inset + 8, size * 0.47);
    context.closePath();
    context.stroke();
    context.strokeRect(size * 0.37, size * 0.36, size * 0.26, size * 0.28);
  };
  panelPaint(layers.map, "rgba(29,29,29,0.56)", 2.7);
  panelPaint(layers.bump, "rgba(43,43,43,0.68)", 3.2);
  panelPaint(layers.roughness, "rgba(246,246,246,0.36)", 2.5);
  for (const x of [40, size - 40]) {
    for (const y of [40, size - 40]) drawBolt(layers, x, y, 5.5, 0.25 + (x + y + seed) * 0.001);
  }
}

function drawCrater(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation: number,
  layer: "map" | "bump" | "roughness",
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);

  if (layer === "map") {
    context.save();
    context.translate(rx * 0.1, ry * 0.16);
    ellipse(context, 0, 0, rx * 0.94, ry * 0.84);
    context.fillStyle = "rgba(22,22,22,0.54)";
    context.fill();
    context.restore();
    const gradient = context.createRadialGradient(-rx * 0.18, -ry * 0.23, Math.max(1, rx * 0.05), 0, 0, rx * 1.05);
    gradient.addColorStop(0, "rgba(49,49,49,0.88)");
    gradient.addColorStop(0.62, "rgba(69,69,69,0.75)");
    gradient.addColorStop(0.79, "rgba(183,183,177,0.92)");
    gradient.addColorStop(0.91, "rgba(89,89,89,0.83)");
    gradient.addColorStop(1, "rgba(127,127,121,0.18)");
    ellipse(context, 0, 0, rx, ry);
    context.fillStyle = gradient;
    context.fill();
  } else if (layer === "bump") {
    const gradient = context.createRadialGradient(-rx * 0.16, -ry * 0.18, 1, 0, 0, rx * 1.1);
    gradient.addColorStop(0, "rgba(74,74,74,0.72)");
    gradient.addColorStop(0.68, "rgba(117,117,117,0.7)");
    gradient.addColorStop(0.8, "rgba(235,235,235,0.95)");
    gradient.addColorStop(0.92, "rgba(82,82,82,0.76)");
    gradient.addColorStop(1, "rgba(127,127,127,0.06)");
    ellipse(context, 0, 0, rx, ry);
    context.fillStyle = gradient;
    context.fill();
  } else {
    const gradient = context.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
    gradient.addColorStop(0, "rgba(246,246,246,0.22)");
    gradient.addColorStop(0.7, "rgba(210,210,210,0.16)");
    gradient.addColorStop(0.82, "rgba(125,125,125,0.34)");
    gradient.addColorStop(1, "rgba(238,238,238,0.07)");
    ellipse(context, 0, 0, rx, ry);
    context.fillStyle = gradient;
    context.fill();
  }
  context.restore();
}

function drawWrappedCrater(layers: TextureLayers, width: number, height: number, x: number, y: number, rx: number, ry: number, rotation: number) {
  const copiesX = [-width, 0, width];
  const copiesY = [-height, 0, height];
  for (const offsetX of copiesX) {
    for (const offsetY of copiesY) {
      const cx = x + offsetX;
      const cy = y + offsetY;
      drawCrater(layers.map, cx, cy, rx, ry, rotation, "map");
      drawCrater(layers.bump, cx, cy, rx, ry, rotation, "bump");
      drawCrater(layers.roughness, cx, cy, rx, ry, rotation, "roughness");
    }
  }
}

function drawRegolith(layers: TextureLayers, width: number, height: number, seed: number, kind: "ground" | "planet") {
  const random = seededRandom(seed ^ (kind === "ground" ? 0x2c45b3 : 0x921eb5));
  const isPlanet = kind === "planet";
  const count = isPlanet ? 65 : 12;
  layers.map.save();
  layers.map.globalAlpha = isPlanet ? .45 : .17;
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const scale = isPlanet ? 1.55 : 1;
    const rx = (isPlanet ? 5 + random() * 26 : 5 + random() * 34) * scale;
    const ry = rx * (0.63 + random() * 0.62);
    drawWrappedCrater(layers, width, height, x, y, rx, ry, random() * Math.PI);
  }
  layers.map.restore();

  const stoneCount = isPlanet ? 34 : 105;
  for (let index = 0; index < stoneCount; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const radius = (isPlanet ? 1.5 + random() * 5 : 1.5 + random() * 8);
    for (const [context, shadow, top] of [
      [layers.map, "rgba(31,31,31,0.42)", "rgba(181,181,174,0.4)"],
      [layers.bump, "rgba(53,53,53,0.66)", "rgba(203,203,203,0.62)"],
      [layers.roughness, "rgba(250,250,250,0.28)", "rgba(103,103,103,0.15)"],
    ] as const) {
      context.save();
      context.translate(x, y);
      context.rotate(random() * Math.PI * 2);
      context.beginPath();
      context.moveTo(-radius * 0.9, radius * 0.3);
      context.lineTo(-radius * 0.38, -radius * 0.72);
      context.lineTo(radius * 0.54, -radius * 0.8);
      context.lineTo(radius, radius * 0.15);
      context.lineTo(radius * 0.34, radius * 0.68);
      context.closePath();
      context.fillStyle = shadow;
      context.fill();
      context.beginPath();
      context.moveTo(-radius * 0.55, radius * 0.06);
      context.lineTo(-radius * 0.24, -radius * 0.55);
      context.lineTo(radius * 0.44, -radius * 0.6);
      context.lineTo(radius * 0.75, radius * 0.04);
      context.closePath();
      context.fillStyle = top;
      context.fill();
      context.restore();
    }
  }
}

function makeSurfaceTextures(kind: SurfaceKind): SurfaceTextures {
  const width = kind === "planet" ? PLANET_SIZE.width : SURFACE_SIZE;
  const height = kind === "planet" ? PLANET_SIZE.height : SURFACE_SIZE;
  const { layers, canvases } = makeLayers(width, height);
  const seed = stringSeed(`orbital-industrial/${kind}/v1`);
  const profile = profiles[kind];
  paintBaseNoise(layers, width, height, profile, seed, kind);

  if (kind === "deck") drawDeckPlate(layers, width, seed);
  if (kind === "armor") drawArmorPanels(layers, width, seed);
  if (kind === "ground" || kind === "planet") drawRegolith(layers, width, height, seed, kind);
  drawScratches(layers, width, height, profile, seed, kind);
  if (kind === "deck" || kind === "armor" || kind === "hazard") {
    drawEdgeChips(layers, SURFACE_SIZE, seed, kind === "deck" ? 82 : 58);
  }

  return {
    map: canvasTexture(canvases.map, true),
    bumpMap: canvasTexture(canvases.bump, false),
    roughnessMap: canvasTexture(canvases.roughness, false),
  };
}

/** Returns shared, deterministic canvas textures for one industrial surface. */
export function getSurfaceTextures(kind: SurfaceKind): SurfaceTextures {
  const cached = surfaceTextureCache.get(kind);
  if (cached) return cached;
  const textures = makeSurfaceTextures(kind);
  surfaceTextureCache.set(kind, textures);
  return textures;
}

const particleTextures = new Map<"smoke" | "glow", THREE.CanvasTexture>();
let damageTexture: THREE.CanvasTexture | null = null;
export function getDamageTexture(): THREE.CanvasTexture {
  if(damageTexture)return damageTexture;
  const {canvas,context}=makeCanvas(256,256);
  const random=seededRandom(8044);
  const gradient=context.createRadialGradient(128,128,8,128,128,105);
  gradient.addColorStop(0,"rgba(12,14,13,.92)");
  gradient.addColorStop(.3,"rgba(22,20,17,.85)");
  gradient.addColorStop(.62,"rgba(42,33,23,.55)");
  gradient.addColorStop(1,"rgba(41,33,21,0)");
  context.fillStyle=gradient;context.fillRect(0,0,256,256);
  for(let i=0;i<13;i++){
    const angle=i/13*Math.PI*2+random()*.25;
    context.beginPath();context.moveTo(128+Math.cos(angle)*20,128+Math.sin(angle)*20);
    for(let j=0;j<5;j++){
      const r=28+j*(10+random()*8),a=angle+(random()-.5)*.23;
      context.lineTo(128+Math.cos(a)*r,128+Math.sin(a)*r);
    }
    context.strokeStyle="rgba(13,14,13,.78)";context.lineWidth=1+random()*2;context.stroke();
  }
  for(let i=0;i<65;i++){
    const a=random()*Math.PI*2,r=random()*83,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;
    context.fillStyle=i%3?"rgba(10,12,12,.5)":"rgba(130,115,82,.35)";
    context.fillRect(x,y,1+random()*4,1+random()*3);
  }
  damageTexture=canvasTexture(canvas,true);return damageTexture;
}
export function getParticleTexture(kind: "smoke" | "glow"): THREE.CanvasTexture {
  const cached = particleTextures.get(kind);
  if (cached) return cached;
  const { canvas, context } = makeCanvas(128, 128);
  const random = seededRandom(kind === "smoke" ? 901 : 903);
  if (kind === "smoke") {
    for(let i=0;i<32;i++){
      const a=random()*Math.PI*2,r=random()*26,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;
      const gradient=context.createRadialGradient(x,y,0,x,y,18+random()*24);
      gradient.addColorStop(0,"rgba(255,255,255,.18)");
      gradient.addColorStop(.4,"rgba(230,230,230,.12)");
      gradient.addColorStop(1,"rgba(200,200,200,0)");
      context.fillStyle=gradient;context.fillRect(0,0,128,128);
    }
  } else {
    const gradient=context.createRadialGradient(64,64,0,64,64,62);
    gradient.addColorStop(0,"rgba(255,255,245,1)");
    gradient.addColorStop(.13,"rgba(255,219,142,.95)");
    gradient.addColorStop(.4,"rgba(255,143,54,.38)");
    gradient.addColorStop(1,"rgba(255,80,20,0)");
    context.fillStyle=gradient;context.fillRect(0,0,128,128);
  }
  const texture=canvasTexture(canvas,true);
  particleTextures.set(kind,texture);
  return texture;
}

/** Builds a transparent, worn stencil mark. Repeated calls share a cached texture. */
export function getMarkTexture(text: string, color = "#e5dfce"): THREE.CanvasTexture {
  const normalizedText = text.trim();
  const key = `${normalizedText}\u0000${color}`;
  const cached = markTextureCache.get(key);
  if (cached) {
    markTextureCache.delete(key);
    markTextureCache.set(key, cached);
    return cached;
  }

  const { canvas, context } = makeCanvas(512, 256);
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (normalizedText.length > 0) {
    const fontFamily = "'Arial Black', 'DIN Condensed', 'Arial Narrow', sans-serif";
    let fontSize = 182;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `900 ${fontSize}px ${fontFamily}`;
    const measuredWidth = context.measureText(normalizedText).width;
    const measuredHeight = context.measureText("Mg").actualBoundingBoxAscent + context.measureText("Mg").actualBoundingBoxDescent;
    fontSize = Math.min(fontSize, fontSize * 458 / Math.max(measuredWidth, 1), fontSize * 196 / Math.max(measuredHeight, 1));
    context.font = `900 ${fontSize}px ${fontFamily}`;
    context.fillStyle = color;
    context.fillText(normalizedText, canvas.width / 2, canvas.height / 2, 466);

    const random = seededRandom(stringSeed(key));
    context.globalCompositeOperation = "destination-out";
    for (let index = 0; index < Math.max(20, normalizedText.length * 15); index += 1) {
      const width = 1 + random() * (normalizedText.length > 5 ? 12 : 7);
      const height = 0.45 + random() * 2.8;
      const x = 24 + random() * 464;
      const y = 30 + random() * 196;
      context.save();
      context.translate(x, y);
      context.rotate((random() - 0.5) * 0.32);
      context.fillRect(-width * 0.5, -height * 0.5, width, height);
      context.restore();
    }
    context.globalCompositeOperation = "source-over";
  }

  const texture = canvasTexture(canvas, true);
  markTextureCache.set(key, texture);
  if (markTextureCache.size > MAX_MARK_CACHE_SIZE) {
    const oldestKey = markTextureCache.keys().next().value;
    if (oldestKey !== undefined) markTextureCache.delete(oldestKey);
  }
  return texture;
}
