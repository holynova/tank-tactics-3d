export type GameAudioKind =
  | "select"
  | "move"
  | "turn"
  | "dice"
  | "fire"
  | "shell"
  | "capture"
  | "debris"
  | "win";

export interface GameAudioOptions {
  /** Stereo position from -1 (left) to 1 (right). */
  pan?: number;
  /** Delay playback by this many seconds. */
  delay?: number;
  /** Set the total sound envelope length in seconds. */
  duration?: number;
}

export interface GameAudio {
  play: (kind: GameAudioKind, options?: GameAudioOptions) => void;
  stop: () => void;
  dispose: () => void;
}

type AudioContextConstructor = new () => AudioContext;

type FilterOptions = {
  type: BiquadFilterType;
  frequency: number;
  endFrequency?: number;
  q?: number;
};

type Voice = {
  context: AudioContext;
  activeVoices: Set<Voice>;
  envelope: GainNode;
  panNode: StereoPannerNode | null;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  startTime: number;
  endTime: number;
  duration: number;
  pan: number;
  density: number;
  endedSources: number;
  stopping: boolean;
  cleaned: boolean;
  delayNode: DelayNode | null;
};

const MIN_GAIN = 0.0001;
const MAX_VOICES = 18;
const MAX_DELAY_SECONDS = 5;
const MAX_DURATION_SECONDS = 4;
const MASTER_GAIN = 0.38;

const DEFAULT_DURATIONS: Record<GameAudioKind, number> = {
  select: 0.12,
  move: 0.92,
  turn: 0.33,
  dice: 0.58,
  fire: 0.86,
  shell: 0.4,
  capture: 1.08,
  debris: 0.98,
  win: 1.15,
};

function getAudioContextConstructor(): AudioContextConstructor | null {
  // Looking up browser-only constructors lazily keeps module evaluation SSR-safe.
  const runtime = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return runtime.AudioContext ?? runtime.webkitAudioContext ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function setParam(param: AudioParam, value: number, time: number): void {
  try {
    param.setValueAtTime(value, time);
  } catch {
    param.value = value;
  }
}

function linearRamp(param: AudioParam, value: number, time: number): void {
  try {
    param.linearRampToValueAtTime(value, time);
  } catch {
    param.value = value;
  }
}

function exponentialRamp(param: AudioParam, value: number, time: number): void {
  try {
    param.exponentialRampToValueAtTime(Math.max(value, MIN_GAIN), time);
  } catch {
    param.value = value;
  }
}

function makeSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function createNoiseBuffer(context: AudioContext): AudioBuffer | null {
  try {
    const length = Math.max(1, Math.floor(context.sampleRate * 1.5));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    const random = makeSeededRandom(0x4f524254);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = (random() * 2 - 1) * 0.72;
    }
    return buffer;
  } catch {
    return null;
  }
}

function createSaturationCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(512 * Float32Array.BYTES_PER_ELEMENT));
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index * 2) / (curve.length - 1) - 1;
    curve[index] = Math.tanh(x * 2.3) / Math.tanh(2.3);
  }
  return curve;
}

const SATURATION_CURVE = createSaturationCurve();

function createEnvelope(voice: Voice, time: number, duration: number, peak: number, attack: number, release: number): GainNode {
  const gain = voice.context.createGain();
  const end = time + duration;
  const attackEnd = Math.min(time + Math.max(0.002, attack), end - 0.002);
  const releaseStart = Math.max(attackEnd, end - Math.max(0.008, release));
  setParam(gain.gain, MIN_GAIN, time);
  linearRamp(gain.gain, Math.max(MIN_GAIN, peak * voice.density), attackEnd);
  if (releaseStart > attackEnd) setParam(gain.gain, Math.max(MIN_GAIN, peak * voice.density), releaseStart);
  exponentialRamp(gain.gain, MIN_GAIN, end);
  voice.nodes.push(gain);
  return gain;
}

function routeLayer(voice: Voice, layerGain: GainNode, panOffset?: number, echo = false): void {
  if (panOffset !== undefined && typeof voice.context.createStereoPanner === "function") {
    const panner = voice.context.createStereoPanner();
    setParam(panner.pan, clamp(voice.pan + panOffset, -1, 1), voice.context.currentTime);
    panner.connect(voice.envelope);
    layerGain.connect(panner);
    voice.nodes.push(panner);
  } else if (voice.panNode) {
    layerGain.connect(voice.panNode);
  } else {
    layerGain.connect(voice.envelope);
  }

  if (echo && voice.delayNode) layerGain.connect(voice.delayNode);
}

function registerSource(voice: Voice, source: AudioScheduledSourceNode): void {
  voice.sources.push(source);
  source.onended = () => {
    if (voice.cleaned) return;
    voice.endedSources += 1;
    if (voice.endedSources >= voice.sources.length) cleanupVoice(voice);
  };
  voice.nodes.push(source);
}

function addOscillator(
  voice: Voice,
  options: {
    frequency: number;
    endFrequency?: number;
    waveform?: OscillatorType;
    offset?: number;
    duration: number;
    gain: number;
    attack?: number;
    release?: number;
    filter?: FilterOptions;
    saturation?: boolean;
    panOffset?: number;
    echo?: boolean;
  },
) {
  const offset = options.offset ?? 0;
  const duration = Math.min(options.duration, voice.duration - offset);
  if (duration <= 0.01) return;
  const start = voice.startTime + offset;
  const end = start + duration;
  const oscillator = voice.context.createOscillator();
  oscillator.type = options.waveform ?? "sine";
  setParam(oscillator.frequency, options.frequency, start);
  if (options.endFrequency !== undefined) linearRamp(oscillator.frequency, options.endFrequency, end);

  let tail: AudioNode = oscillator;
  if (options.filter) {
    const filter = voice.context.createBiquadFilter();
    filter.type = options.filter.type;
    setParam(filter.frequency, options.filter.frequency, start);
    if (options.filter.endFrequency !== undefined) linearRamp(filter.frequency, options.filter.endFrequency, end);
    if (options.filter.q !== undefined) setParam(filter.Q, options.filter.q, start);
    oscillator.connect(filter);
    voice.nodes.push(filter);
    tail = filter;
  }
  if (options.saturation) {
    const shaper = voice.context.createWaveShaper();
    shaper.curve = SATURATION_CURVE;
    shaper.oversample = "2x";
    tail.connect(shaper);
    voice.nodes.push(shaper);
    tail = shaper;
  }

  const layerGain = createEnvelope(
    voice,
    start,
    duration,
    options.gain,
    options.attack ?? 0.004,
    options.release ?? Math.min(0.08, duration * 0.38),
  );
  tail.connect(layerGain);
  routeLayer(voice, layerGain, options.panOffset, options.echo);
  try {
    registerSource(voice, oscillator);
    oscillator.start(start);
  } catch {
    forgetFailedSource(voice, oscillator);
    return;
  }
  try {
    oscillator.stop(end + 0.012);
  } catch {
    try { oscillator.stop(); } catch { /* best effort */ }
  }
}

function addNoise(
  voice: Voice,
  noiseBuffer: AudioBuffer | null,
  options: {
    offset?: number;
    duration: number;
    gain: number;
    filter?: FilterOptions;
    attack?: number;
    release?: number;
    loop?: boolean;
    saturation?: boolean;
    panOffset?: number;
    echo?: boolean;
  },
) {
  if (!noiseBuffer) return;
  const offset = options.offset ?? 0;
  const duration = Math.min(options.duration, voice.duration - offset);
  if (duration <= 0.01) return;
  const start = voice.startTime + offset;
  const end = start + duration;
  const source = voice.context.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = options.loop ?? false;

  let tail: AudioNode = source;
  if (options.filter) {
    const filter = voice.context.createBiquadFilter();
    filter.type = options.filter.type;
    setParam(filter.frequency, options.filter.frequency, start);
    if (options.filter.endFrequency !== undefined) linearRamp(filter.frequency, options.filter.endFrequency, end);
    if (options.filter.q !== undefined) setParam(filter.Q, options.filter.q, start);
    source.connect(filter);
    voice.nodes.push(filter);
    tail = filter;
  }
  if (options.saturation) {
    const shaper = voice.context.createWaveShaper();
    shaper.curve = SATURATION_CURVE;
    shaper.oversample = "2x";
    tail.connect(shaper);
    voice.nodes.push(shaper);
    tail = shaper;
  }

  const layerGain = createEnvelope(
    voice,
    start,
    duration,
    options.gain,
    options.attack ?? 0.003,
    options.release ?? Math.min(0.1, duration * 0.45),
  );
  tail.connect(layerGain);
  routeLayer(voice, layerGain, options.panOffset, options.echo);
  try {
    registerSource(voice, source);
    source.start(start);
  } catch {
    forgetFailedSource(voice, source);
    return;
  }
  try {
    source.stop(end + 0.012);
  } catch {
    try { source.stop(); } catch { /* best effort */ }
  }
}

function forgetFailedSource(voice: Voice, source: AudioScheduledSourceNode): void {
  source.onended = null;
  const index = voice.sources.indexOf(source);
  if (index !== -1) voice.sources.splice(index, 1);
  try { source.stop(); } catch { /* start may not have succeeded */ }
  try { source.disconnect(); } catch { /* best effort */ }
}

function cleanupVoice(voice: Voice): void {
  if (voice.cleaned) return;
  voice.cleaned = true;
  voice.activeVoices.delete(voice);
  for (const source of voice.sources) {
    source.onended = null;
    try { source.stop(); } catch { /* source may already have ended */ }
  }
  for (const node of voice.nodes) {
    try { node.disconnect(); } catch { /* node may already be disconnected */ }
  }
}

function stopVoice(voice: Voice, fadeSeconds: number): void {
  if (voice.cleaned || voice.stopping) return;
  voice.stopping = true;
  const now = voice.context.currentTime;
  const queued = voice.startTime > now + 0.002;
  const fadeEnd = now + (queued ? 0.004 : Math.max(0.012, fadeSeconds));

  try {
    const holdable = voice.envelope.gain as AudioParam & { cancelAndHoldAtTime?: (time: number) => void };
    if (typeof holdable.cancelAndHoldAtTime === "function") holdable.cancelAndHoldAtTime(now);
    else {
      voice.envelope.gain.cancelScheduledValues(now);
      setParam(voice.envelope.gain, Math.max(MIN_GAIN, voice.envelope.gain.value), now);
    }
    linearRamp(voice.envelope.gain, MIN_GAIN, fadeEnd);
  } catch {
    setParam(voice.envelope.gain, MIN_GAIN, now);
  }

  const stopTime = voice.context.state === "running" ? fadeEnd + 0.014 : now;
  for (const source of voice.sources) {
    try { source.stop(stopTime); } catch { /* source may already be scheduled to stop */ }
  }
  if (voice.sources.length === 0 || voice.context.state !== "running") cleanupVoice(voice);
}

function addClack(
  voice: Voice,
  noiseBuffer: AudioBuffer | null,
  offset: number,
  level: number,
  panOffset?: number,
  low = false,
) {
  const length = low ? 0.12 : 0.067;
  addNoise(voice, noiseBuffer, {
    offset,
    duration: length,
    gain: level * (low ? 0.8 : 0.56),
    filter: low ? { type: "lowpass", frequency: 820, q: 0.8 } : { type: "bandpass", frequency: 1750, q: 1.45 },
    attack: 0.002,
    release: length * 0.8,
    panOffset,
  });
  addOscillator(voice, {
    frequency: low ? 118 : 440 + level * 4600,
    endFrequency: low ? 76 : 275 + level * 2600,
    waveform: low ? "triangle" : "sine",
    offset,
    duration: low ? 0.13 : 0.052,
    gain: level * (low ? 0.54 : 0.38),
    attack: 0.002,
    release: low ? 0.1 : 0.045,
    filter: low ? { type: "lowpass", frequency: 380, q: 0.7 } : { type: "highpass", frequency: 420, q: 0.8 },
    panOffset,
  });
}

function buildSelect(voice: Voice, noise: AudioBuffer | null) {
  // A tiny latch click: filtered metal noise with two short resonant partials.
  addNoise(voice, noise, { duration: 0.055, gain: 0.034, filter: { type: "bandpass", frequency: 2450, q: 1.7 }, release: 0.05 });
  addOscillator(voice, { frequency: 1680, endFrequency: 920, duration: 0.06, gain: 0.024, waveform: "triangle", filter: { type: "bandpass", frequency: 1650, q: 2.1 }, release: 0.052 });
  addOscillator(voice, { frequency: 840, endFrequency: 610, duration: 0.085, gain: 0.014, waveform: "sine", filter: { type: "bandpass", frequency: 900, q: 1.2 }, release: 0.075 });
}

function buildTurn(voice: Voice, noise: AudioBuffer | null) {
  // Servo wind-up under a quiet gear flutter and a few positive detents.
  const duration = Math.min(voice.duration, 0.38);
  addOscillator(voice, { frequency: 72, endFrequency: 124, duration, gain: 0.105, waveform: "sawtooth", filter: { type: "bandpass", frequency: 370, q: 1.1 }, attack: 0.025, release: 0.08 });
  addOscillator(voice, { frequency: 148, endFrequency: 220, duration: duration * 0.83, gain: 0.042, waveform: "triangle", filter: { type: "lowpass", frequency: 920, q: 0.7 }, attack: 0.02, release: 0.07 });
  addNoise(voice, noise, { duration: duration * 0.92, gain: 0.058, filter: { type: "lowpass", frequency: 880, q: 0.7 }, attack: 0.02, release: 0.08, loop: true });
  for (const offset of [0.035, 0.12, 0.205, 0.28]) {
    if (offset < duration) addClack(voice, noise, offset, 0.033, undefined, false);
  }
}

function buildMove(voice: Voice, noise: AudioBuffer | null) {
  // A subdued electric drive tone is topped by a repeating track-and-idler rhythm.
  addOscillator(voice, { frequency: 46, endFrequency: 62, duration: voice.duration * 0.94, gain: 0.135, waveform: "sine", filter: { type: "lowpass", frequency: 150, q: 0.8 }, attack: 0.08, release: 0.13, echo: true });
  addOscillator(voice, { frequency: 94, endFrequency: 132, duration: voice.duration * 0.84, gain: 0.052, waveform: "sawtooth", filter: { type: "lowpass", frequency: 310, q: 0.6 }, attack: 0.07, release: 0.12 });
  addNoise(voice, noise, { duration: voice.duration * 0.9, gain: 0.078, filter: { type: "lowpass", frequency: 720, q: 0.6 }, attack: 0.1, release: 0.14, loop: true });
  const rhythm = [0.08, 0.205, 0.33, 0.455, 0.58, 0.705, 0.83];
  const scale = voice.duration / 0.92;
  rhythm.forEach((offset, index) => {
    const level = index === rhythm.length - 1 ? 0.054 : 0.036 + (index % 2) * 0.006;
    addClack(voice, noise, offset * scale, level, undefined, index === rhythm.length - 1);
  });
}

function buildDice(voice: Voice, noise: AudioBuffer | null, sequence: number) {
  // Uneven impacts and a final heavier stop sell a physical handful of dice.
  const random = makeSeededRandom(0xd1ce + sequence * 0x9e3779b9);
  const taps = 8;
  const usable = Math.max(0.25, voice.duration * 0.86);
  let offset = 0.018;
  for (let index = 0; index < taps; index += 1) {
    const isFinal = index === taps - 1;
    const level = isFinal ? 0.05 : 0.021 + random() * 0.014;
    addClack(voice, noise, Math.min(offset, usable - 0.04), level, (random() - 0.5) * 0.3, isFinal);
    offset += 0.047 + random() * 0.055;
  }
}

function buildFire(voice: Voice, noise: AudioBuffer | null) {
  // Breech latch, pressure impulse and a decaying broadband report make the shot read as a cannon, not a beam.
  addClack(voice, noise, 0, 0.068, -0.08);
  addClack(voice, noise, 0.042, 0.046, 0.1, true);
  // Upper body harmonic keeps the thump audible on small phone speakers.
  addOscillator(voice, { frequency: 126, endFrequency: 68, duration: .2, gain: .095, waveform: "triangle", filter: { type: "lowpass", frequency: 420, q: .65 }, attack: .002, release: .18 });
  addOscillator(voice, { frequency: 49, endFrequency: 27, duration: Math.min(0.48, voice.duration * 0.62), gain: 0.3, waveform: "sine", filter: { type: "lowpass", frequency: 128, q: 0.72 }, attack: 0.002, release: 0.39, echo: true });
  addNoise(voice, noise, { offset: 0.003, duration: Math.min(0.16, voice.duration * 0.24), gain: 0.2, filter: { type: "bandpass", frequency: 720, endFrequency: 360, q: 0.55 }, saturation: true, attack: 0.001, release: 0.14, panOffset: -0.04 });
  addNoise(voice, noise, { offset: 0.009, duration: Math.min(0.3, voice.duration * 0.42), gain: 0.17, filter: { type: "lowpass", frequency: 1450, endFrequency: 420, q: 0.62 }, saturation: true, attack: 0.003, release: 0.26, echo: true });
  addNoise(voice, noise, { offset: 0.045, duration: Math.min(0.72, voice.duration * 0.88), gain: 0.105, filter: { type: "lowpass", frequency: 620, endFrequency: 190, q: 0.58 }, attack: 0.012, release: 0.64, loop: true, echo: true, panOffset: 0.12 });
}

function buildShell(voice: Voice, noise: AudioBuffer | null) {
  // A descending filtered noise pass is air and pressure rushing by, with no pitched laser sweep.
  addNoise(voice, noise, { duration: Math.min(0.36, voice.duration * 0.92), gain: 0.105, filter: { type: "bandpass", frequency: 2450, endFrequency: 520, q: 0.72 }, attack: 0.008, release: 0.24, panOffset: -0.08 });
  addNoise(voice, noise, { offset: 0.035, duration: Math.min(0.24, voice.duration * 0.62), gain: 0.035, filter: { type: "lowpass", frequency: 780, endFrequency: 260, q: 0.62 }, attack: 0.012, release: 0.19, echo: true, panOffset: 0.12 });
}

function buildCapture(voice: Voice, noise: AudioBuffer | null) {
  // Detonation has a sub impact, a brief cracked report, then a wide falling rubble/aftershock bed.
  addOscillator(voice, { frequency: 148, endFrequency: 76, duration: .24, gain: .085, waveform: "triangle", filter: { type: "lowpass", frequency: 480, q: .6 }, attack: .002, release: .21 });
  addOscillator(voice, { frequency: 54, endFrequency: 26, duration: Math.min(0.58, voice.duration * 0.58), gain: 0.28, waveform: "sine", filter: { type: "lowpass", frequency: 145, q: 0.7 }, attack: 0.003, release: 0.48, echo: true });
  addNoise(voice, noise, { offset: 0.003, duration: Math.min(0.2, voice.duration * 0.2), gain: 0.21, filter: { type: "lowpass", frequency: 1850, endFrequency: 760, q: 0.58 }, saturation: true, attack: 0.001, release: 0.18, echo: true });
  addNoise(voice, noise, { offset: 0.016, duration: Math.min(0.72, voice.duration * 0.74), gain: 0.13, filter: { type: "lowpass", frequency: 1100, endFrequency: 270, q: 0.52 }, attack: 0.018, release: 0.62, loop: true, echo: true });
  addNoise(voice, noise, { offset: 0.006, duration: Math.min(0.16, voice.duration * 0.18), gain: 0.087, filter: { type: "highpass", frequency: 2350, endFrequency: 820, q: 0.7 }, attack: 0.001, release: 0.14, panOffset: -0.3 });
  const fragments = [0.13, 0.31, 0.5, 0.7, 0.88];
  fragments.forEach((offset, index) => {
    const level = 0.048 - index * 0.004;
    addClack(voice, noise, offset, level, (index % 2 === 0 ? 1 : -1) * (0.22 + index * 0.04), index === 0 || index === 4);
  });
  addNoise(voice, noise, { offset: 0.34, duration: Math.min(0.56, voice.duration * 0.56), gain: 0.052, filter: { type: "bandpass", frequency: 1050, endFrequency: 430, q: 0.76 }, attack: 0.012, release: 0.49, echo: true, panOffset: 0.38 });
}

function buildDebris(voice: Voice, noise: AudioBuffer | null) {
  // A soft falling grit bed followed by spaced, asymmetrical pieces landing around the impact site.
  addNoise(voice, noise, { offset: 0.015, duration: Math.min(0.7, voice.duration * 0.74), gain: 0.065, filter: { type: "lowpass", frequency: 1700, endFrequency: 340, q: 0.65 }, attack: 0.012, release: 0.61, loop: true, echo: true, panOffset: -0.08 });
  const fragments = [0.07, 0.23, 0.42, 0.64, 0.81];
  fragments.forEach((offset, index) => {
    const level = 0.034 + (index % 2) * 0.008;
    addClack(voice, noise, offset, level, index % 2 === 0 ? -0.34 : 0.32, index === 1 || index === 4);
  });
}

function buildWin(voice: Voice) {
  // A small three-note brass-like chord rises above the mechanical mix without a fanfare blast.
  const chord = [220, 277.18, 329.63];
  chord.forEach((frequency, index) => {
    const offset = index === 0 ? 0 : 0.045;
    addOscillator(voice, { frequency, endFrequency: frequency * 1.004, offset, duration: Math.min(0.82, voice.duration * 0.78), gain: 0.052, waveform: "triangle", filter: { type: "lowpass", frequency: 1350, q: 0.55 }, attack: 0.1, release: 0.28, echo: index === 2 });
    addOscillator(voice, { frequency: frequency * 2.01, endFrequency: frequency * 2, offset, duration: Math.min(0.66, voice.duration * 0.62), gain: 0.014, waveform: "sawtooth", filter: { type: "lowpass", frequency: 1780, q: 0.6 }, attack: 0.12, release: 0.24 });
  });
}

/** Creates a small synthesized sound system with bounded, stoppable Web Audio voices. */
export function createGameAudio(enabledGetter: () => boolean): GameAudio {
  const activeVoices = new Set<Voice>();
  let context: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let compressor: DynamicsCompressorNode | null = null;
  let masterGain: GainNode | null = null;
  let disposed = false;
  let playSequence = 0;

  const getContext = (): AudioContext | null => {
    if (disposed) return null;
    if (context?.state === "closed") {
      for (const voice of [...activeVoices]) cleanupVoice(voice);
      context = null;
      noiseBuffer = null;
      compressor = null;
      masterGain = null;
    }
    if (context) return context;

    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass) return null;

    let created: AudioContext;
    try {
      created = new AudioContextClass();
    } catch {
      return null;
    }

    try {
      const output = created.createGain();
      output.gain.value = MASTER_GAIN;
      try {
        const limiter = created.createDynamicsCompressor();
        limiter.threshold.value = -18;
        limiter.knee.value = 16;
        limiter.ratio.value = 4;
        limiter.attack.value = 0.006;
        limiter.release.value = 0.22;
        output.connect(limiter);
        limiter.connect(created.destination);
        compressor = limiter;
      } catch {
        compressor = null;
        output.connect(created.destination);
      }
      masterGain = output;
      context = created;
      noiseBuffer = createNoiseBuffer(created);
      return context;
    } catch {
      void created.close().catch(() => undefined);
      context = null;
      masterGain = null;
      compressor = null;
      noiseBuffer = null;
      return null;
    }
  };

  const createVoice = (audioContext: AudioContext, options: GameAudioOptions, duration: number): Voice | null => {
    if (!masterGain) return null;
    const now = audioContext.currentTime;
    const delay = clamp(options.delay ?? 0, 0, MAX_DELAY_SECONDS);
    const startTime = now + delay;
    const endTime = startTime + duration;
    const pan = clamp(options.pan ?? 0, -1, 1);
    const density = clamp(Math.sqrt(7 / (activeVoices.size + 1)), 0.48, 1);
    const envelope = audioContext.createGain();
    const attack = Math.min(0.009, duration * 0.08);
    const release = Math.min(0.075, duration * 0.2);
    setParam(envelope.gain, MIN_GAIN, now);
    setParam(envelope.gain, MIN_GAIN, startTime);
    linearRamp(envelope.gain, density, startTime + attack);
    const releaseStart = Math.max(startTime + attack, endTime - release);
    if (releaseStart > startTime + attack) setParam(envelope.gain, density, releaseStart);
    exponentialRamp(envelope.gain, MIN_GAIN, endTime);

    const voice: Voice = {
      context: audioContext,
      activeVoices,
      envelope,
      panNode: null,
      sources: [],
      nodes: [envelope],
      startTime,
      endTime,
      duration,
      pan,
      density,
      endedSources: 0,
      stopping: false,
      cleaned: false,
      delayNode: null,
    };

    if (typeof audioContext.createStereoPanner === "function") {
      const panNode = audioContext.createStereoPanner();
      setParam(panNode.pan, pan, now);
      panNode.connect(envelope);
      voice.panNode = panNode;
      voice.nodes.push(panNode);
    }
    envelope.connect(masterGain);

    // A single low-level slapback adds a little enclosure to impacts without a feedback tail.
    try {
      const delayNode = audioContext.createDelay(0.3);
      setParam(delayNode.delayTime, 0.085, now);
      const echoGain = audioContext.createGain();
      setParam(echoGain.gain, 0.13, now);
      delayNode.connect(echoGain);
      const echoPan = typeof audioContext.createStereoPanner === "function" ? audioContext.createStereoPanner() : null;
      if (echoPan) {
        setParam(echoPan.pan, clamp(pan * -0.55, -1, 1), now);
        echoGain.connect(echoPan);
        echoPan.connect(envelope);
        voice.nodes.push(echoPan);
      } else {
        echoGain.connect(envelope);
      }
      voice.nodes.push(delayNode, echoGain);
      voice.delayNode = delayNode;
    } catch {
      voice.delayNode = null;
    }
    activeVoices.add(voice);
    return voice;
  };

  const stop = (): void => {
    for (const voice of [...activeVoices]) stopVoice(voice, 0.055);
  };

  const play = (kind: GameAudioKind, options: GameAudioOptions = {}): void => {
    if (disposed) return;
    let enabled = false;
    try { enabled = enabledGetter(); } catch { return; }
    if (!enabled) return;

    const audioContext = getContext();
    if (!audioContext) return;

    let voice: Voice | null = null;
    try {
      if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
        void audioContext.resume().catch(() => undefined);
      }
      if (activeVoices.size >= MAX_VOICES) {
        const oldest = activeVoices.values().next().value as Voice | undefined;
        if (oldest) stopVoice(oldest, 0.02);
        return;
      }

      const duration = clamp(options.duration ?? DEFAULT_DURATIONS[kind], 0.05, MAX_DURATION_SECONDS);
      voice = createVoice(audioContext, options, duration);
      if (!voice) return;
      playSequence += 1;

      switch (kind) {
        case "select": buildSelect(voice, noiseBuffer); break;
        case "turn": buildTurn(voice, noiseBuffer); break;
        case "move": buildMove(voice, noiseBuffer); break;
        case "dice": buildDice(voice, noiseBuffer, playSequence); break;
        case "fire": buildFire(voice, noiseBuffer); break;
        case "shell": buildShell(voice, noiseBuffer); break;
        case "capture": buildCapture(voice, noiseBuffer); break;
        case "debris": buildDebris(voice, noiseBuffer); break;
        case "win": buildWin(voice); break;
      }

      if (voice.sources.length === 0) cleanupVoice(voice);
    } catch {
      if (voice) cleanupVoice(voice);
      // Audio is optional: unsupported nodes, autoplay restrictions, or partial
      // browser implementations should degrade to silence without interrupting play.
    }
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const voice of [...activeVoices]) cleanupVoice(voice);
    const currentContext = context;
    context = null;
    noiseBuffer = null;
    compressor = null;
    masterGain = null;
    if (!currentContext) return;
    try {
      void currentContext.close().catch(() => undefined);
    } catch {
      // Closing an already-closed context is harmless for game state.
    }
  };

  return { play, stop, dispose };
}
