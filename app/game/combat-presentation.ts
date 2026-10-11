import { AIM_SECONDS, PROJECTILE_SECONDS } from "./animation";
import type { Piece } from "./types";

export interface ShotCue { id: string; attacker: Piece; victim: Piece; delay: number }

/** One cue sheet drives shells, recoil, sound and impact settlement. Never changes capture rules. */
export function buildShotCues(pieces: Piece[], attackerIds: string[], victimIds: string[]): ShotCue[] {
  const attackers = pieces.filter(p => attackerIds.includes(p.id));
  return pieces.filter(p => victimIds.includes(p.id)).flatMap((victim, index) => {
    const aligned = attackers.filter(p => p.row === victim.row || p.col === victim.col)
      .sort((a,b) => Math.abs(a.row-victim.row)+Math.abs(a.col-victim.col)-Math.abs(b.row-victim.row)-Math.abs(b.col-victim.col));
    return aligned.slice(0,2).map((attacker, shooter) => ({
      id: `${attacker.id}-${victim.id}`, attacker, victim,
      delay: AIM_SECONDS + index*.12 + shooter*.065,
    }));
  });
}

export function impactDelayMs(cues: ShotCue[]): number {
  return Math.ceil((Math.max(0,...cues.map(cue => cue.delay)) + PROJECTILE_SECONDS + .025)*1000);
}

/** Fast kick, slow hydraulic return, no repeated elastic bouncing. */
export function cannonRecoil(seconds: number): number {
  if(seconds < 0 || seconds > .65) return 0;
  if(seconds < .045) return seconds/.045;
  return Math.exp(-(seconds-.045)*8) * (1-Math.min(1,(seconds-.045)/.605));
}
