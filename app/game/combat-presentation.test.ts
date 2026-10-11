import { describe, expect, it } from "vitest";
import { buildShotCues, cannonRecoil, impactDelayMs } from "./combat-presentation";
import { AIM_SECONDS, PROJECTILE_SECONDS } from "./animation";
import type { Piece } from "./types";

const pieces:Piece[]=[
  {id:"a",row:1,col:0,color:"blue",facing:0},
  {id:"b",row:2,col:0,color:"blue",facing:0},
  {id:"v",row:0,col:0,color:"red",facing:180},
  {id:"x",row:3,col:3,color:"blue",facing:0},
];
describe("artillery cue sheet",()=>{
  it("fires the nearest aligned pair, with bounded stagger",()=>{
    const cues=buildShotCues(pieces,["b","x","a"],["v"]);
    expect(cues.map(c=>c.attacker.id)).toEqual(["a","b"]);
    expect(cues[0].delay).toBe(AIM_SECONDS);
    expect(cues[1].delay).toBeCloseTo(AIM_SECONDS+.065);
    expect(impactDelayMs(cues)).toBeGreaterThanOrEqual((cues[1].delay+PROJECTILE_SECONDS)*1000);
  });
  it("doesn't fabricate shots without aligned attackers or victims",()=>{
    expect(buildShotCues(pieces,["x"],["v"])).toEqual([]);
    expect(buildShotCues(pieces,["a"],[])).toEqual([]);
  });
  it("recoil has one hard kick and a monotonic damped return",()=>{
    expect(cannonRecoil(-.1)).toBe(0);
    expect(cannonRecoil(0)).toBe(0);
    expect(cannonRecoil(.045)).toBe(1);
    expect(cannonRecoil(.15)).toBeGreaterThan(cannonRecoil(.3));
    expect(cannonRecoil(.3)).toBeGreaterThan(cannonRecoil(.5));
    expect(cannonRecoil(.7)).toBe(0);
  });
});
