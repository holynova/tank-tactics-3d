import { afterEach, describe, expect, it, vi } from "vitest";
import { createGameAudio } from "./audio";

type ParamEvent = { method: string; value?: number; time: number };

class FakeAudioParam {
  value = 0;
  events: ParamEvent[] = [];
  setValueAtTime = vi.fn((value: number, time: number) => {
    this.value = value;
    this.events.push({ method: "set", value, time });
  });
  linearRampToValueAtTime = vi.fn((value: number, time: number) => {
    this.value = value;
    this.events.push({ method: "linear", value, time });
  });
  exponentialRampToValueAtTime = vi.fn((value: number, time: number) => {
    this.value = value;
    this.events.push({ method: "exponential", value, time });
  });
  cancelScheduledValues = vi.fn((time: number) => {
    this.events.push({ method: "cancel", time });
  });
  cancelAndHoldAtTime = vi.fn((time: number) => {
    this.events.push({ method: "hold", time });
  });
}

class FakeNode {
  connect = vi.fn((_destination: FakeNode) => undefined);
  disconnect = vi.fn(() => undefined);
}

class FakeGainNode extends FakeNode {
  gain = new FakeAudioParam();
}

class FakeStereoPannerNode extends FakeNode {
  pan = new FakeAudioParam();
}

class FakeDelayNode extends FakeNode {
  delayTime = new FakeAudioParam();
}

class FakeSourceNode extends FakeNode {
  onended: (() => void) | null = null;
  startCalls: number[] = [];
  stopCalls: Array<number | undefined> = [];
  start = vi.fn((time = 0) => {
    this.startCalls.push(time);
  });
  stop = vi.fn((time?: number) => {
    this.stopCalls.push(time);
  });
}

class FakeOscillatorNode extends FakeSourceNode {
  frequency = new FakeAudioParam();
  type = "sine";
}

class FakeBufferSourceNode extends FakeSourceNode {
  buffer: FakeAudioBuffer | null = null;
  loop = false;
}

class FakeBiquadFilterNode extends FakeNode {
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
  type = "lowpass";
}

class FakeWaveShaperNode extends FakeNode {
  curve: Float32Array | null = null;
  oversample = "none";
}

class FakeDynamicsCompressorNode extends FakeNode {
  threshold = new FakeAudioParam();
  knee = new FakeAudioParam();
  ratio = new FakeAudioParam();
  attack = new FakeAudioParam();
  release = new FakeAudioParam();
}

class FakeAudioBuffer {
  private readonly channels: Float32Array[];

  constructor(channelCount: number, length: number) {
    this.channels = Array.from({ length: channelCount }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  readonly destination = new FakeNode();
  readonly sampleRate = 8_000;
  readonly sources: FakeSourceNode[] = [];
  readonly panners: FakeStereoPannerNode[] = [];
  readonly filters: FakeBiquadFilterNode[] = [];
  currentTime = 10;
  state: "running" | "suspended" | "closed" = "running";
  close = vi.fn(async () => {
    this.state = "closed";
  });
  resume = vi.fn(async () => {
    this.state = "running";
  });

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createDynamicsCompressor(): FakeDynamicsCompressorNode {
    return new FakeDynamicsCompressorNode();
  }

  createStereoPanner(): FakeStereoPannerNode {
    const panner = new FakeStereoPannerNode();
    this.panners.push(panner);
    return panner;
  }

  createDelay(_maxDelayTime?: number): FakeDelayNode {
    return new FakeDelayNode();
  }

  createBuffer(channels: number, length: number, _sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(channels, length);
  }

  createOscillator(): FakeOscillatorNode {
    const source = new FakeOscillatorNode();
    this.sources.push(source);
    return source;
  }

  createBufferSource(): FakeBufferSourceNode {
    const source = new FakeBufferSourceNode();
    this.sources.push(source);
    return source;
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    const filter = new FakeBiquadFilterNode();
    this.filters.push(filter);
    return filter;
  }

  createWaveShaper(): FakeWaveShaperNode {
    return new FakeWaveShaperNode();
  }
}

function installFakeAudioContext(): void {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("game audio lifecycle", () => {
  it("creates the context lazily, and disabled playback creates no sources", () => {
    installFakeAudioContext();
    let enabled = false;
    const audio = createGameAudio(() => enabled);

    expect(FakeAudioContext.instances).toHaveLength(0);
    audio.play("select");
    expect(FakeAudioContext.instances).toHaveLength(0);

    enabled = true;
    audio.play("select");
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].sources.length).toBeGreaterThan(0);
    expect(FakeAudioContext.instances[0].sources.every((source) => source.start.mock.calls.length > 0)).toBe(true);
    audio.dispose();
  });

  it("schedules all layers after the requested delay and applies stereo pan", () => {
    installFakeAudioContext();
    const audio = createGameAudio(() => true);

    audio.play("select", { pan: 0.65, delay: 0.75 });

    const context = FakeAudioContext.instances[0];
    expect(context).toBeDefined();
    expect(context.sources.length).toBeGreaterThan(0);
    expect(context.sources.flatMap((source) => source.startCalls)).toEqual(
      expect.arrayContaining(context.sources.map(() => 10.75)),
    );
    expect(context.sources.every((source) => source.startCalls[0] >= 10.75)).toBe(true);
    expect(context.panners.some((panner) =>
      panner.pan.events.some((event) => event.method === "set" && event.value === 0.65 && event.time === 10),
    )).toBe(true);
    audio.dispose();
  });

  it("stops both queued and already-active voices", () => {
    installFakeAudioContext();
    const audio = createGameAudio(() => true);

    audio.play("select", { delay: 2 });
    const context = FakeAudioContext.instances[0];
    const queuedSources = [...context.sources];
    audio.play("move");
    const activeSources = context.sources.slice(queuedSources.length);
    expect(queuedSources.length).toBeGreaterThan(0);
    expect(activeSources.length).toBeGreaterThan(0);

    audio.stop();

    expect(queuedSources.every((source) => source.stopCalls.length >= 2)).toBe(true);
    expect(activeSources.every((source) => source.stopCalls.length >= 2)).toBe(true);
    expect(queuedSources.every((source) => (source.stopCalls.at(-1) ?? Infinity) < 10.03)).toBe(true);
    expect(activeSources.every((source) => (source.stopCalls.at(-1) ?? Infinity) < 10.08)).toBe(true);
  });

  it("disposes idempotently, closes the context, and ignores future playback", async () => {
    installFakeAudioContext();
    const audio = createGameAudio(() => true);
    audio.play("fire");
    const context = FakeAudioContext.instances[0];
    expect(context.sources.length).toBeGreaterThan(0);
    const sourceCount = context.sources.length;

    audio.dispose();
    audio.dispose();
    await Promise.resolve();
    audio.play("capture");

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(sourceCount);
    expect(context.sources.every((source) => source.stopCalls.length >= 2)).toBe(true);
  });

  it.each([
    { kind: "fire" as const, minimumSources: 8, minimumStartTimes: 4 },
    { kind: "capture" as const, minimumSources: 14, minimumStartTimes: 7 },
  ])("builds a layered $kind impact and lets stop cancel its scheduled layers", ({ kind, minimumSources, minimumStartTimes }) => {
    installFakeAudioContext();
    const audio = createGameAudio(() => true);

    audio.play(kind, { delay: 0.4 });

    const context = FakeAudioContext.instances[0];
    const impactSources = [...context.sources];
    const startTimes = impactSources.map((source) => source.startCalls[0]).filter((time) => time !== undefined);
    expect(impactSources.length).toBeGreaterThanOrEqual(minimumSources);
    expect(startTimes.length).toBe(impactSources.length);
    expect(new Set(startTimes).size).toBeGreaterThanOrEqual(minimumStartTimes);
    expect(Math.min(...startTimes)).toBeCloseTo(10.4);

    audio.stop();

    expect(impactSources.every((source) => source.stopCalls.length >= 2)).toBe(true);
  });

  it("makes shell pass-bys from descending filtered noise and schedules them after delay", () => {
    installFakeAudioContext();
    const audio = createGameAudio(() => true);

    audio.play("shell", { pan: -0.55, delay: 0.8 });

    const context = FakeAudioContext.instances[0];
    expect(context.sources.length).toBeGreaterThanOrEqual(2);
    expect(context.sources.every((source) => source instanceof FakeBufferSourceNode)).toBe(true);
    expect(context.sources.every((source) => source.startCalls[0] >= 10.8)).toBe(true);
    expect(context.filters.some((filter) => {
      const initial = filter.frequency.events.find((event) => event.method === "set")?.value;
      return filter.frequency.events.some((event) => event.method === "linear" && event.value !== undefined && initial !== undefined && event.value < initial);
    })).toBe(true);

    audio.stop();
    expect(context.sources.every((source) => source.stopCalls.length >= 2)).toBe(true);
  });

  it("stages debris fragments after the requested delay and cancels their scheduled impacts", () => {
    installFakeAudioContext();
    const audio = createGameAudio(() => true);

    audio.play("debris", { pan: 0.3, delay: 0.55 });

    const context = FakeAudioContext.instances[0];
    const debrisSources = [...context.sources];
    const startTimes = debrisSources.map((source) => source.startCalls[0]).filter((time) => time !== undefined);
    expect(debrisSources.length).toBeGreaterThanOrEqual(10);
    expect(Math.min(...startTimes)).toBeCloseTo(10.565);
    expect(Math.max(...startTimes)).toBeGreaterThan(11.3);

    audio.stop();
    expect(debrisSources.every((source) => source.stopCalls.length >= 2)).toBe(true);
  });
});
