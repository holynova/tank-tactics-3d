"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CombatFx } from "../../game/use-game-controller";
import { AIM_SECONDS, BURST_SECONDS } from "../../game/animation";
import { getParticleTexture } from "./industrial-materials";

type Vec3=[number,number,number];

/** Physical debris and soft volumetric-looking billows, without a postprocessing pass. */
export function ArtilleryImpact({position,reducedMotion}:{position:Vec3;reducedMotion:boolean}) {
  const mobile=useThree(state=>state.size.width<620);
  const count=reducedMotion?8:mobile?76:112;
  const start=useRef<number|null>(null);
  const sparks=useRef<THREE.InstancedMesh>(null), chunks=useRef<THREE.InstancedMesh>(null);
  const rings=useRef<Array<THREE.Mesh|null>>([]);
  const billows=useRef<Array<THREE.Sprite|null>>([]),fire=useRef<Array<THREE.Sprite|null>>([]);
  const light=useRef<THREE.PointLight>(null);
  const dummy=useMemo(()=>new THREE.Object3D(),[]);
  const smoke=useMemo(()=>getParticleTexture("smoke"),[]),glow=useMemo(()=>getParticleTexture("glow"),[]);
  const trajectories=useMemo(()=>Array.from({length:count},(_,i)=>{
    const a=i*2.399963, speed=1.2+(i*37%100)/35;
    return {vx:Math.cos(a)*speed,vz:Math.sin(a)*speed,vy:1.2+(i*19%100)/38,size:.022+(i%7)*.004};
  }),[count]);
  useEffect(()=>{
    const color=new THREE.Color();
    trajectories.forEach((_,i)=>sparks.current?.setColorAt(i,color.set(i%5===0?"#fff4c4":i%3===0?"#ffdf7e":"#ff7b30")));
    if(sparks.current?.instanceColor)sparks.current.instanceColor.needsUpdate=true;
  },[trajectories]);
  useFrame(({clock})=>{
    if(start.current===null)start.current=clock.elapsedTime;
    const age=clock.elapsedTime-start.current,t=Math.min(age/BURST_SECONDS,1);
    const intensity=reducedMotion?.35:1;
    if(light.current)light.current.intensity=intensity*(32*Math.exp(-age*17)+8*Math.exp(-age*4));
    rings.current.forEach((ring,i)=>{
      if(!ring)return;
      const elapsed=Math.max(0,age-i*.06),life=i===0?.48:.8;
      ring.visible=age>i*.06&&elapsed<life;
      ring.scale.setScalar(.45+elapsed*(i===0?8.5:5));
      (ring.material as THREE.MeshBasicMaterial).opacity=intensity*Math.pow(Math.max(0,1-elapsed/life),2)*(i===0?.85:.4);
    });
    fire.current.forEach((sprite,i)=>{
      if(!sprite)return;
      const life=i===0?.23:.52, elapsed=Math.max(0,age-i*.035);
      sprite.visible=age>=i*.035&&elapsed<life;
      const a=i*2.399;
      sprite.position.set(position[0]+Math.cos(a)*elapsed*.9,position[1]+elapsed*(.9+i*.12),position[2]+Math.sin(a)*elapsed*.9);
      sprite.scale.setScalar((i===0?1.5:.65)+Math.sin(Math.min(1,elapsed/life)*Math.PI)*(i===0?1.7:1.2));
      sprite.material.opacity=Math.pow(Math.max(0,1-elapsed/life),1.25)*intensity;
    });
    billows.current.forEach((sprite,i)=>{
      if(!sprite)return;
      const dust=i<6,a=i*2.399,delay=dust?0:.11+(i%3)*.045;
      const elapsed=Math.max(0,age-delay), life=dust?1.35:BURST_SECONDS-delay;
      sprite.visible=age>=delay&&elapsed<life;
      const drift=dust?elapsed*1.7:elapsed*.43;
      sprite.position.set(position[0]+Math.cos(a)*(.1+drift),dust?.16+elapsed*.1:position[1]+elapsed*(.65+i%3*.17),position[2]+Math.sin(a)*(.1+drift));
      const size=dust?.5+elapsed*1.35:.55+elapsed*1.15;
      sprite.scale.set(size,dust?size*.32:size*.95,1);
      sprite.material.opacity=intensity*(dust?.52:.8)*Math.min(1,elapsed*14)*Math.pow(Math.max(0,1-elapsed/life),.85);
      sprite.material.rotation=a+elapsed*.14;
      sprite.material.color.set(dust?"#9b8b70":elapsed<.24?"#e89b52":"#4b4947");
    });
    trajectories.forEach((p,i)=>{
      const flight=Math.min(age,1.15),y=position[1]+p.vy*flight-4.8*flight*flight;
      dummy.position.set(position[0]+p.vx*flight,Math.max(.115,y),position[2]+p.vz*flight);
      dummy.rotation.set(i*.4+age*8,i*.7+age*4,age*5);
      const fade=Math.max(0,1-age/1.15);
      dummy.scale.set(p.size*fade,p.size*fade,p.size*(3.5+Math.min(age,.2)*10)*fade);
      dummy.updateMatrix();sparks.current?.setMatrixAt(i,dummy.matrix);
      if(i<18){
        const fall=Math.min(age,.8), ground=position[1]+p.vy*fall-5.6*fall*fall;
        dummy.position.set(position[0]+p.vx*fall*.45,Math.max(.14,ground),position[2]+p.vz*fall*.45);
        dummy.rotation.set(i*.34+Math.min(age,.85)*6,i*.7,i*.23+Math.min(age,.85)*7);
        dummy.scale.setScalar((.045+(i%4)*.014)*(1-Math.max(0,t-.75)*4));
        dummy.updateMatrix();chunks.current?.setMatrixAt(i,dummy.matrix);
      }
    });
    if(sparks.current){sparks.current.instanceMatrix.needsUpdate=true;(sparks.current.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/1.15);}
    if(chunks.current)chunks.current.instanceMatrix.needsUpdate=true;
  });
  return <group raycast={()=>undefined}>
    {[0,1].map(i=><mesh key={i} ref={mesh=>{rings.current[i]=mesh;}} position={[position[0],.115+i*.004,position[2]]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[.25,i===0?.28:.34,48]}/><meshBasicMaterial color={i===0?"#ffcb85":"#c9b394"} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/>
    </mesh>)}
    {Array.from({length:5},(_,i)=><sprite key={`f${i}`} ref={sprite=>{fire.current[i]=sprite;}} position={position}>
      <spriteMaterial map={glow} color={i===0?"#fff3d1":"#ff872f"} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/>
    </sprite>)}
    {Array.from({length:reducedMotion?4:14},(_,i)=><sprite key={`s${i}`} ref={sprite=>{billows.current[i]=sprite;}} position={position}>
      <spriteMaterial map={smoke} transparent depthWrite={false} opacity={0}/>
    </sprite>)}
    <instancedMesh ref={sparks} args={[undefined,undefined,count]} frustumCulled={false}>
      <boxGeometry args={[1,1,1]}/><meshBasicMaterial vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={chunks} args={[undefined,undefined,Math.min(18,count)]} frustumCulled={false}>
      <dodecahedronGeometry args={[1,0]}/><meshStandardMaterial color="#625c52" metalness={.6} roughness={.65}/>
    </instancedMesh>
    <pointLight ref={light} position={position} color="#ffad56" intensity={0} distance={6} decay={2}/>
  </group>;
}

/** Two priority passes remove the previous shake before OrbitControls, so the user's camera never drifts. */
export function ArtilleryCameraFeedback({fx,reducedMotion}:{fx:CombatFx;reducedMotion:boolean}) {
  const camera=useThree(state=>state.camera);
  const offset=useRef(new THREE.Vector3());
  const start=useRef<number|null>(null),signature=useRef("");
  useEffect(()=>()=>{camera.position.sub(offset.current);offset.current.set(0,0,0);},[camera]);
  useFrame(()=>{camera.position.sub(offset.current);offset.current.set(0,0,0);},-2);
  useFrame(({clock})=>{
    const impact=fx.burstPositions.length>0;
    const key=impact?`hit:${fx.burstPositions.map(p=>`${p.row}/${p.col}`).join(',')}`:fx.attackerIds.join(',');
    if(key!==signature.current){signature.current=key;start.current=clock.elapsedTime;}
    if(!key||reducedMotion||start.current===null)return;
    const age=clock.elapsedTime-start.current-(impact?0:AIM_SECONDS);
    if(age<0||age>.65)return;
    const strength=(impact?.105:.032)*Math.exp(-age*(impact?7:14));
    offset.current.set(Math.sin(age*91)*strength,Math.cos(age*73)*strength*.6,0);
    camera.position.add(offset.current);
  });
  return null;
}
