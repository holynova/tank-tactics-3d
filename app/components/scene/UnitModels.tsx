"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PlayerColor, ThemeId } from "../../game/types";
import { getMarkTexture, getSurfaceTextures } from "./industrial-materials";
import { AIM_SECONDS } from "../../game/animation";

export interface UnitMotionState {
  moving: boolean; turning: boolean; phase: number; travel: number; turn: number;
}

export interface GameUnitProps {
  themeId: ThemeId; color: PlayerColor; selected: boolean; disabled?: boolean;
  variant?: number; aimAngle?: number; firing?: boolean;
  motion?: React.RefObject<UnitMotionState>;
}
type Finish = "paint" | "steel" | "dark" | "rubber" | "brass" | "lamp";
type BakedParts = Array<{ finish: Finish; geometry: THREE.BufferGeometry }>;
type Vec = [number, number, number];
const decorativeRaycast: THREE.Mesh["raycast"] = () => undefined;

/** Small mechanical details are baked by finish: one draw call per material, not per bolt. */
class Parts {
  geometries = new Map<Finish, THREE.BufferGeometry[]>();
  add(finish: Finish, geometry: THREE.BufferGeometry, position: Vec, rotation: Vec = [0, 0, 0]) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(matrix);
    const bucket = finish === "brass" ? "steel" : finish === "rubber" ? "dark" : finish;
    const tint = new THREE.Color(finish === "brass" ? "#c6b382" : finish === "rubber" ? "#667074" : "#ffffff");
    const colors = new Float32Array(g.attributes.position.count * 3);
    for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}
    g.setAttribute("color",new THREE.BufferAttribute(colors,3));
    const list = this.geometries.get(bucket) ?? [];
    list.push(g); this.geometries.set(bucket, list);
    if (g !== geometry) geometry.dispose();
  }
  box(f: Finish, size: Vec, p: Vec, r: Vec = [0, 0, 0], bevel = 0.014) {
    this.add(f, new RoundedBoxGeometry(...size, 1, Math.min(bevel, ...size.map(s => s * .22))), p, r);
  }
  cylinder(f: Finish, radius: number, length: number, p: Vec, r: Vec = [0, 0, 0], bottom = radius) {
    this.add(f, new THREE.CylinderGeometry(radius, bottom, length, 12), p, r);
  }
  bake(): BakedParts {
    return [...this.geometries].map(([finish, parts]) => {
      const geometry = mergeGeometries(parts)!;
      parts.forEach(g => g.dispose());
      return { finish, geometry };
    });
  }
}

function hullGeometry(walker: boolean): BakedParts {
  const p = new Parts();
  if (!walker) {
    p.box("dark", [.86, .18, 1.02], [0, .23, -.06]);
    p.box("paint", [.8, .13, .88], [0, .35, -.05]);
    p.box("paint", [.82, .12, .26], [0, .32, .48], [.24, 0, 0]);
    p.box("steel", [.76, .065, .09], [0, .24, .62]);
    for (const side of [-1, 1]) {
      p.box("rubber", [.23, .27, 1.12], [side * .48, .16, -.055], [0, 0, 0], .07);
      p.box("paint", [.18, .065, 1.1], [side * .48, .32, -.05]);
      for (let i = 0; i < 6; i++) {
        const z = -.46 + i * .165;
        p.cylinder("dark", .114, .045, [side * .601, .155, z], [0, 0, Math.PI / 2]);
        p.cylinder("steel", .071, .052, [side * .609, .155, z], [0, 0, Math.PI / 2]);
        p.cylinder("brass", .026, .058, [side * .616, .155, z], [0, 0, Math.PI / 2]);
      }
      p.box("dark", [.12, .07, .085], [side * .29, .37, .52]);
      p.box("lamp", [.078, .035, .018], [side * .29, .375, .568]);
      p.cylinder("steel", .036, .27, [side * .31, .35, -.49], [Math.PI / 2, 0, 0]);
      p.cylinder("dark", .022, .028, [side * .31, .35, -.636], [Math.PI / 2, 0, 0]);
      for (const z of [-.44, -.24, .08, .37]) p.cylinder("brass", .012, .012, [side * .39, .427, z]);
    }
    p.box("dark", [.4, .022, .22], [0, .425, -.38]);
    for (let i = 0; i < 8; i++) p.box("steel", [.018, .016, .22], [-.16 + i * .046, .44, -.38]);
    p.box("steel", [.24, .022, .15], [0, .433, .34]);
    p.cylinder("dark", .035, .07, [.3, .45, -.37]);
    p.cylinder("steel", .006, .42, [.3, .69, -.37]);
  } else {
    p.box("dark", [.54, .18, .6], [0, .46, 0]);
    p.box("paint", [.6, .15, .51], [0, .57, -.015]);
    for (const side of [-1, 1]) {
      p.box("dark", [.13, .09, .14], [side * .23, .6, .28]);
      p.box("lamp", [.07, .035, .018], [side * .23, .615, .357]);
      p.box("steel", [.055, .14, .2], [side * .32, .57, -.18]);
    }
  }
  return p.bake();
}

function turretGeometry(walker: boolean) {
  const p = new Parts(), b = new Parts();
  p.cylinder("steel", .24, .06, [0, .02, 0]);
  p.cylinder("dark", .22, .065, [0, .075, 0]);
  p.box("paint", [walker ? .5 : .61, .26, .57], [0, .2, -.015], [0, 0, 0], .05);
  for (const side of [-1, 1]) {
    p.box("steel", [.05, .16, .34], [side * .31, .19, -.045]);
    p.box("paint", [.065, .12, .2], [side * .34, .2, .04], [0, side * -.14, 0]);
    for (const z of [-.15, 0, .15]) p.cylinder("brass", .013, .016, [side * .3, .345, z]);
    p.box("dark", [.065, .075, .16], [side * .2, .367, .07]);
    p.box("lamp", [.042, .025, .015], [side * .2, .38, .16]);
  }
  p.cylinder("dark", .12, .036, [0, .35, -.11]);
  p.cylinder("steel", .085, .026, [0, .374, -.11]);
  p.box("steel", [.13, .022, .035], [0, .4, -.1]);
  p.box("dark", [.33, .08, .13], [0, .16, -.32]);
  for(let i=0;i<6;i++)p.box("steel", [.027, .068, .015], [-.13+i*.052, .16, -.39]);
  const length = walker ? .48 : .78;
  b.cylinder("steel", .12, .26, [0, .2, .34], [Math.PI / 2, 0, 0], .14);
  b.cylinder("dark", .083, length, [0, .2, .48 + length / 2], [Math.PI / 2, 0, 0]);
  b.cylinder("steel", .063, length + .07, [0, .2, .48 + length / 2], [Math.PI / 2, 0, 0]);
  for(let i=0;i<4;i++)b.cylinder(i===1?"paint":"steel", .08-i*.003, .043, [0, .2, .51+i*length*.23], [Math.PI / 2, 0, 0]);
  b.cylinder("dark", walker ? .105 : .078, .15, [0, .2, .5+length], [Math.PI / 2, 0, 0]);
  b.cylinder("steel", walker ? .12 : .085, .032, [0, .2, .59+length], [Math.PI / 2, 0, 0]);
  b.cylinder("rubber", walker ? .085 : .058, .005, [0, .2, .607+length], [Math.PI / 2, 0, 0]);
  return { turret: p.bake(), barrel: b.bake() };
}
const hulls = new Map<boolean, BakedParts>();
const turrets = new Map<boolean, ReturnType<typeof turretGeometry>>();
function geometryFor(walker:boolean) {
  if(!hulls.has(walker))hulls.set(walker,hullGeometry(walker));
  if(!turrets.has(walker))turrets.set(walker,turretGeometry(walker));
  return {hull:hulls.get(walker)!, ...turrets.get(walker)!};
}

function useFinishes(color: PlayerColor, themeId: ThemeId) {
  const materials = useMemo(() => {
    const steel=getSurfaceTextures("steel"), armor=getSurfaceTextures("armor");
    const paint = color === "red" ? (themeId === "abyss" ? "#a45037" : "#af5134") : (themeId === "abyss" ? "#6495a3" : "#467b91");
    const make=(color:string, metalness:number, roughness:number, textures=steel)=>new THREE.MeshStandardMaterial({color,metalness,roughness,...textures,bumpScale:.012,vertexColors:true});
    return {
      paint:make(paint,.58,.61,armor), steel:make("#868b8a",.82,.48), dark:make("#363c3d",.72,.7),
      rubber:make("#14191b",.15,.96), brass:make("#a88b57",.76,.42),
      lamp:new THREE.MeshStandardMaterial({color:"#ffc16a",emissive:"#ff9b37",emissiveIntensity:2.1,roughness:.25}),
    } satisfies Record<Finish, THREE.Material>;
  },[color,themeId]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  return materials;
}
function MeshParts({parts,materials}:{parts:BakedParts;materials:Record<Finish,THREE.Material>}) {
  return <>{parts.map(({finish,geometry})=><mesh key={finish} geometry={geometry} material={materials[finish]} raycast={decorativeRaycast} castShadow receiveShadow dispose={null}/>)}</>;
}

let legParts: BakedParts | null = null;
function getLegGeometry(): BakedParts {
  if(legParts)return legParts;
  const buckets=new Map<Finish,THREE.BufferGeometry[]>();
  let index=0;
  for(const side of [-1,1])for(const front of [-1,1]){
    const p=new Parts();
    p.cylinder("brass",.072,.1,[side*.29,.45,front*.2],[0,0,Math.PI/2]);
    p.box("paint",[.17,.25,.16],[side*.37,.33,front*.3],[front*-.28,0,side*.36]);
    p.cylinder("steel",.065,.19,[side*.43,.24,front*.37],[0,0,Math.PI/2]);
    p.box("steel",[.095,.24,.1],[side*.45,.125,front*.43],[front*.28,0,side*-.14]);
    p.cylinder("brass",.022,.23,[side*.39,.2,front*.41],[front*.45,0,side*-.2]);
    p.box("dark",[.23,.06,.27],[side*.46,.035,front*.46]);
    p.box("paint",[.2,.045,.14],[side*.46,.079,front*.5]);
    for(const {finish,geometry} of p.bake()){
      const count=geometry.attributes.position.count;
      const indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
      for(let i=0;i<count;i++){indices[i*4]=index;weights[i*4]=1;}
      geometry.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(indices,4));
      geometry.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
      const list=buckets.get(finish)??[];list.push(geometry);buckets.set(finish,list);
    }
    index++;
  }
  legParts=[...buckets].map(([finish,parts])=>{
    const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return {finish,geometry};
  });
  return legParts;
}
function createLegRig(materials:Record<Finish,THREE.Material>) {
  const object=new THREE.Group();
  const bones:THREE.Bone[]=[];
  for(const side of [-1,1])for(const front of [-1,1]){
    const bone=new THREE.Bone();bone.position.set(side*.24,.46,front*.18);
    object.add(bone);bones.push(bone);
  }
  const skeleton=new THREE.Skeleton(bones);
  const meshes=getLegGeometry().map(({finish,geometry})=>{
    const mesh=new THREE.SkinnedMesh(geometry,materials[finish]);
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=decorativeRaycast;
    object.add(mesh);return mesh;
  });
  object.updateMatrixWorld(true);
  meshes.forEach(mesh=>mesh.bind(skeleton));
  return {object,bones,skeleton};
}
let beltParts: BakedParts | null = null;
function TankTracks({materials,motion}:{materials:Record<Finish,THREE.Material>;motion?:React.RefObject<UnitMotionState>}) {
  const parts=useMemo(()=>{
    if(!beltParts){const p=new Parts();p.box("dark",[.248,.032,.069],[0,0,0]);p.box("steel",[.244,.012,.018],[0,.019,0]);beltParts=p.bake();}
    return beltParts;
  },[]);
  const instances=useRef<Array<THREE.InstancedMesh|null>>([]);
  const last=useRef({travel:-1,turn:-1});
  const dummy=useMemo(()=>new THREE.Object3D(),[]);
  useFrame(()=>{
    const travel=motion?.current.travel??0,turn=motion?.current.turn??0;
    if(last.current.travel===travel&&last.current.turn===turn)return;
    last.current={travel,turn};
    const straight=.85,radius=.135,path=2*straight+2*Math.PI*radius;
    for(let sideIndex=0;sideIndex<2;sideIndex++)for(let link=0;link<32;link++){
      const side=sideIndex?1:-1;
      const d=((link/32*path+travel+side*turn*.46)%path+path)%path;
      let z:number,y:number,angle:number;
      if(d<straight){z=-straight/2+d;y=.16+radius;angle=0;}
      else if(d<straight+Math.PI*radius){angle=(d-straight)/radius;z=straight/2+Math.sin(angle)*radius;y=.16+Math.cos(angle)*radius;}
      else if(d<2*straight+Math.PI*radius){z=straight/2-(d-straight-Math.PI*radius);y=.16-radius;angle=Math.PI;}
      else{angle=Math.PI+(d-2*straight-Math.PI*radius)/radius;z=-straight/2+Math.sin(angle)*radius;y=.16+Math.cos(angle)*radius;}
      dummy.position.set(side*.48,y,z-.055);dummy.rotation.set(angle,0,0);dummy.updateMatrix();
      instances.current.forEach(mesh=>mesh?.setMatrixAt(sideIndex*32+link,dummy.matrix));
    }
    instances.current.forEach(mesh=>{if(mesh)mesh.instanceMatrix.needsUpdate=true;});
  });
  return <>{parts.map(({finish,geometry},i)=><instancedMesh key={finish} ref={mesh=>{instances.current[i]=mesh;}} args={[geometry,materials[finish],64]} raycast={decorativeRaycast} castShadow receiveShadow dispose={null}/>)}</>;
}

export function GameUnit({themeId,color,selected,variant=0,aimAngle=0,firing=false,motion}:GameUnitProps) {
  const walker=variant%2===1;
  const geometries=useMemo(()=>geometryFor(walker),[walker]);
  const materials=useFinishes(color,themeId);
  const legs=useMemo(()=>walker?createLegRig(materials):null,[walker,materials]);
  useEffect(()=>()=>legs?.skeleton.dispose(),[legs]);
  const turret=useRef<THREE.Group>(null), barrel=useRef<THREE.Group>(null);
  const started=useRef(-10), wasFiring=useRef(false);
  const mark=useMemo(()=>getMarkTexture(`0${variant+1}`),[variant]);
  useFrame(({clock},delta)=>{
    if(firing&&!wasFiring.current)started.current=clock.elapsedTime;
    wasFiring.current=firing;
    const t=clock.elapsedTime-started.current-AIM_SECONDS;
    if(turret.current){
      const yaw=turret.current.rotation.y;
      const difference=Math.atan2(Math.sin(aimAngle-yaw),Math.cos(aimAngle-yaw));
      turret.current.rotation.y=yaw+difference*(1-Math.exp(-delta*13));
    }
    if(barrel.current)barrel.current.position.z=t<0?0:-Math.max(0,Math.sin(t*34))*Math.exp(-t*9)*.13;
    if(legs){
      const state=motion?.current;
      const phase=state?.phase??0,weight=state?.moving?Math.min(1,phase*8,(1-phase)*8):0;
      legs.bones.forEach((bone,i)=>{
        const angle=phase*Math.PI*6+(i===0||i===3?0:Math.PI);
        bone.rotation.x=Math.sin(angle)*.3*weight;
        bone.rotation.z=Math.cos(angle)*.06*weight*(i<2?-1:1);
        bone.position.y=.46+Math.max(0,Math.sin(angle))*.075*weight;
      });
    }
  });
  return <group scale={.93}>
    <MeshParts parts={geometries.hull} materials={materials}/>
    {legs?<primitive object={legs.object} dispose={null}/>:<TankTracks materials={materials} motion={motion}/>}
    <group ref={turret} position={[0,walker ? .62 : .42,0]}>
      <MeshParts parts={geometries.turret} materials={materials}/>
      <group ref={barrel} rotation={[-.055,0,0]}><MeshParts parts={geometries.barrel} materials={materials}/></group>
      {[-1,1].map(side=><mesh key={side} raycast={decorativeRaycast} position={[side*.365,.21,-.09]} rotation={[0,side*Math.PI/2,0]}>
        <planeGeometry args={[.2,.12]}/><meshStandardMaterial map={mark} transparent alphaTest={.12} polygonOffset polygonOffsetFactor={-2} roughness={.8}/>
      </mesh>)}
    </group>
    {selected&&<mesh raycast={decorativeRaycast} position={[0,.014,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.61,.635,48]}/><meshBasicMaterial color="#ffc75f" toneMapped={false} transparent opacity={.95}/></mesh>}
  </group>;
}
