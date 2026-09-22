export type GameAudioKind =
  | "select"
  | "move"
  | "dice"
  | "fire"
  | "capture"
  | "win";

export interface GameAudio {
  play: (kind: GameAudioKind) => void;
  dispose: () => void;
}

type AudioContextConstructor = new () => AudioContext;

interface Tone {
  frequency: number;
  duration: number;
  offset?: number;
  slideTo?: number;
  volume?: number;
  waveform?: OscillatorType;
}

const TONES: Record<GameAudioKind, readonly Tone[]> = {
  select: [{ frequency: 660, duration: 0.06, volume: 0.04 }],
  move: [{ frequency: 280, slideTo: 420, duration: 0.11, volume: 0.045 }],
  dice: [
    { frequency: 460, duration: 0.06, volume: 0.04, waveform: "triangle" },
    { frequency: 620, duration: 0.08, offset: 0.06, volume: 0.04, waveform: "triangle" },
  ],
  fire: [
    { frequency: 190, slideTo: 90, duration: 0.15, volume: 0.055, waveform: "sawtooth" },
  ],
  capture: [
    { frequency: 150, slideTo: 65, duration: 0.19, volume: 0.06, waveform: "square" },
  ],
  win: [
    { frequency: 520, duration: 0.1, volume: 0.045 },
    { frequency: 780, duration: 0.2, offset: 0.08, volume: 0.05 },
  ],
};

const MIN_GAIN = 0.0001;

function getAudioContextConstructor(): AudioContextConstructor | null {
  // `globalThis` exists in browsers and during SSR; looking up the constructor
  // only when playback is requested keeps module evaluation SSR-safe.
  const runtime = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return runtime.AudioContext ?? runtime.webkitAudioContext ?? null;
}

function setParamValue(param: AudioParam, value: number, time: number): void {
  if (typeof param.setValueAtTime === "function") {
    param.setValueAtTime(value, time);
  } else {
    param.value = value;
  }
}

function rampParamValue(param: AudioParam, value: number, time: number): void {
  if (typeof param.exponentialRampToValueAtTime === "function") {
    param.exponentialRampToValueAtTime(value, time);
  } else if (typeof param.linearRampToValueAtTime === "function") {
    param.linearRampToValueAtTime(value, time);
  } else {
    param.value = value;
  }
}

/** Create short, synthesized game feedback without requiring audio assets. */
export function createGameAudio(enabledGetter: () => boolean): GameAudio {
  let context: AudioContext | null = null;
  let disposed = false;

  const getContext = (): AudioContext | null => {
    if (context || disposed) return context;

    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass) return null;

    try {
      context = new AudioContextClass();
    } catch {
      // Audio is an optional enhancement. A blocked or unavailable context
      // must never prevent the game from running.
      return null;
    }
    return context;
  };

  const play = (kind: GameAudioKind): void => {
    if (disposed || !enabledGetter()) return;

    const audioContext = getContext();
    if (!audioContext) return;

    try {
      const resumableContext = audioContext as AudioContext & {
        resume?: () => Promise<void>;
      };
      if (resumableContext.state === "suspended" && resumableContext.resume) {
        const resumeResult = resumableContext.resume();
        void resumeResult.catch(() => undefined);
      }

      const tones = TONES[kind];
      if (!tones) return;
      const now = audioContext.currentTime;

      for (const tone of tones) {
        const start = now + (tone.offset ?? 0);
        const end = start + tone.duration;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = tone.waveform ?? "sine";
        setParamValue(oscillator.frequency, tone.frequency, start);
        if (tone.slideTo !== undefined) {
          if (typeof oscillator.frequency.linearRampToValueAtTime === "function") {
            oscillator.frequency.linearRampToValueAtTime(tone.slideTo, end);
          } else {
            oscillator.frequency.value = tone.slideTo;
          }
        }

        setParamValue(gain.gain, MIN_GAIN, start);
        const attackEnd = start + Math.min(0.015, tone.duration / 3);
        rampParamValue(gain.gain, tone.volume ?? 0.05, attackEnd);
        rampParamValue(gain.gain, MIN_GAIN, end);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.01);
      }
    } catch {
      // Browser autoplay policies and partially implemented test/browser
      // contexts should degrade to silence rather than break game input.
    }
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;

    const currentContext = context;
    context = null;
    if (!currentContext) return;

    try {
      const closeResult = currentContext.close();
      void closeResult.catch(() => undefined);
    } catch {
      // Closing an already-closed context is harmless for game state.
    }
  };

  return { play, dispose };
}
