"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { getMarkTexture, getSurfaceTextures } from "./industrial-materials";

export const DECK_TILE = new RoundedBoxGeometry(1.385,.18,1.385,1,.022);
const BASE = new RoundedBoxGeometry(6.25,.5,6.25,1,.085);

export function DeckPlatform() {
  const steel=useMemo(()=>getSurfaceTextures("steel"),[]);
  const hazard=useMemo(()=>getSurfaceTextures("hazard"),[]);
  const number=useMemo(()=>getMarkTexture("04"),[]);
  const slogan=useMemo(()=>getMarkTexture("STAND FIRM"),[]);
  const bolts=useRef<THREE.InstancedMesh>(null);
  const positions=useMemo(()=>{
    const p:THREE.Vector3[]=[];
    for(let row=0;row<4;row++)for(let col=0;col<4;col++)for(const x of [-.62,.62])for(const z of [-.62,.62])
      p.push(new THREE.Vector3((col-1.5)*1.42+x,.116,(row-1.5)*1.42+z));
    for(const side of [-1,1])for(let i=0;i<13;i++){
      p.push(new THREE.Vector3(side*3.02,.096,-3+i*.5));
      p.push(new THREE.Vector3(-3+i*.5,.096,side*3.02));
    }
    return p;
  },[]);
  useEffect(()=>{
    const dummy=new THREE.Object3D();
    positions.forEach((p,i)=>{dummy.position.copy(p);dummy.updateMatrix();bolts.current?.setMatrixAt(i,dummy.matrix);});
    if(bolts.current)bolts.current.instanceMatrix.needsUpdate=true;
  },[positions]);
  return <group>
    <mesh geometry={BASE} position={[0,-.24,0]} receiveShadow castShadow dispose={null}><meshStandardMaterial {...steel} color="#747670" metalness={.76} roughness={.68} bumpScale={.025}/></mesh>
    <mesh position={[0,-.015,0]}><boxGeometry args={[5.85,.05,5.85]}/><meshStandardMaterial color="#1b2021" roughness={.86}/></mesh>
    {[-1,1].map(side=><group key={side}>
      <mesh position={[0,.035,side*3.03]} receiveShadow><boxGeometry args={[6.05,.085,.16]}/><meshStandardMaterial {...steel} color="#9a9b91" metalness={.78} roughness={.6}/></mesh>
      <mesh position={[side*3.03,.035,0]} receiveShadow><boxGeometry args={[.16,.085,6.05]}/><meshStandardMaterial {...steel} color="#9a9b91" metalness={.78} roughness={.6}/></mesh>
      {[-1,1].map(end=><mesh key={end} position={[side*3,.1,end*3]}><boxGeometry args={[.32,.09,.32]}/><meshStandardMaterial {...steel} color="#6e7775" roughness={.7} metalness={.7}/></mesh>)}
    </group>)}
    {Array.from({length:4},(_,i)=><group key={i} position={[(i-1.5)*1.52,-.23,3.14]}>
      <mesh><boxGeometry args={[1.47,.35,.085]}/><meshStandardMaterial {...steel} color="#4f5553" metalness={.73} roughness={.7} bumpScale={.03}/></mesh>
      <mesh position={[0,.115,.046]}><planeGeometry args={[1.25,.074]}/><meshStandardMaterial {...hazard} color="#c0a476" metalness={.6} roughness={.72}/></mesh>
      <mesh position={[0,-.012,.05]}><planeGeometry args={[i===2?.66:.33,.16]}/><meshStandardMaterial map={i===2?slogan:number} transparent alphaTest={.15} roughness={.9}/></mesh>
    </group>)}
    <instancedMesh ref={bolts} args={[undefined,undefined,positions.length]}>
      <cylinderGeometry args={[.025,.025,.014,6]}/><meshStandardMaterial color="#a6a18a" metalness={.83} roughness={.4}/>
    </instancedMesh>
    {[-1,1].map(side=><mesh key={side} position={[side*2.88,-.08,3.195]}><boxGeometry args={[.08,.045,.015]}/><meshStandardMaterial color="#ffd89d" emissive="#ffb759" emissiveIntensity={2.3}/></mesh>)}
  </group>;
}
