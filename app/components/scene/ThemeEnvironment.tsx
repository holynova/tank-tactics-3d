"use client";

import { Environment, Lightformer, Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ThemeId } from "../../game/types";
import { getMarkTexture, getSurfaceTextures } from "./industrial-materials";
import { FortressStructure as Building } from "./FortressStructures";

export interface ThemeEnvironmentProps { themeId: ThemeId }

function terrainGeometry() {
  const g = new THREE.PlaneGeometry(38, 24, 90, 70);
  g.rotateX(-Math.PI / 2);
  g.translate(0,0,4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x=p.getX(i),z=p.getZ(i), distance=Math.hypot(x,z);
    const noise=Math.sin(x*.81+Math.cos(z*.74))*Math.cos(z*.61)+Math.sin(x*2.31+z*1.61)*.18;
    const hills=Math.max(0,Math.min(1,(distance-5)/7));
    let elevation=-.72+hills*(noise*.6+Math.sin(x*.2-z*.27)*.65);
    for(const [cx,cz,r] of [[-5,-3,1.4],[5,-4,.8],[-4.5,1.5,.7],[5,2.5,1.3],[-1,-6,1.1],[4,7,1.1]]){
      const d=Math.hypot(x-cx,z-cz)/r;
      elevation+=-.36*Math.exp(-d*d*2)+.14*Math.exp(-(d-1)*(d-1)*12);
    }
    p.setY(i,elevation);
  }
  const uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*9,uv.getY(i)*6);
  g.computeVertexNormals(); return g;
}
function rubbleGeometry() {
  const parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<210;i++){
    const a=i*2.399963,r=5.4+(i*17%220)/10;
    const size=.07+(i*31%100)/210;
    const p=new THREE.Vector3(Math.cos(a)*r,-.52,Math.sin(a)*r);
    if(p.z < -7 || Math.abs(p.x)>18)continue;
    const g=new THREE.DodecahedronGeometry(size,0).toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromEuler(new THREE.Euler(a,a*.34,a*.12)),new THREE.Vector3(1.3,.7,1)));
    parts.push(g);
  }
  const result=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return result;
}

function FortressGun() {
  const steel=useMemo(()=>getSurfaceTextures("steel"),[]);
  const mark=useMemo(()=>getMarkTexture("03"),[]);
  return <group position={[-4.2,-.5,-5.5]} rotation={[0,-.18,0]}>
    <Building position={[0,0,0]} scale={1.55} variant={0}/>
    <mesh position={[0,1.95,0]}><cylinderGeometry args={[.63,.72,.7,18]}/><meshStandardMaterial {...steel} color="#767e77" metalness={.7} roughness={.6}/></mesh>
    <mesh position={[0,2.4,0]}><cylinderGeometry args={[1.03,1.16,.55,24]}/><meshStandardMaterial {...steel} color="#646865" metalness={.8} roughness={.6} bumpScale={.035}/></mesh>
    <group position={[0,2.8,0]}>
      <mesh castShadow rotation={[0,0,-.14]}><boxGeometry args={[2.1,1.18,1.32]}/><meshStandardMaterial {...steel} color="#4c5556" metalness={.78} roughness={.59} bumpScale={.04}/></mesh>
      <mesh position={[0,0,.675]}><planeGeometry args={[.8,.5]}/><meshStandardMaterial map={mark} transparent alphaTest={.1} roughness={.9}/></mesh>
      <group position={[1,.12,0]} rotation={[0,0,-Math.PI/2-.1]}>
        <mesh position={[0,.9,0]}><cylinderGeometry args={[.28,.45,1.8,24]}/><meshStandardMaterial {...steel} color="#5e6260" metalness={.85} roughness={.48} bumpScale={.03}/></mesh>
        <mesh position={[0,2.35,0]}><cylinderGeometry args={[.22,.28,1.4,24]}/><meshStandardMaterial {...steel} color="#77796e" metalness={.88} roughness={.45}/></mesh>
        {[.25,.55,1.4,1.75,2.4,2.95].map(y=><mesh key={y} position={[0,y,0]}><cylinderGeometry args={[y<1.5?.39:.3,y<1.5?.39:.3,.11,24]}/><meshStandardMaterial {...steel} color="#353d3f" metalness={.8} roughness={.57}/></mesh>)}
        <mesh position={[0,3.08,0]}><cylinderGeometry args={[.185,.185,.02,24]}/><meshStandardMaterial color="#0a0d0e" roughness={1}/></mesh>
      </group>
    </group>
    <mesh position={[-.95,4.2,-.4]}><boxGeometry args={[.15,5.4,.2]}/><meshStandardMaterial {...steel} color="#3f4748" metalness={.8} roughness={.6}/></mesh>
    <mesh position={[-.95,4.3,-.25]}><planeGeometry args={[.8,2.7]}/><meshStandardMaterial color="#814a32" side={THREE.DoubleSide} roughness={1}/></mesh>
    {Array.from({length:5},(_,i)=><mesh key={i} position={[-.85,1+i*.52,.73]}><boxGeometry args={[.18,.09,.06]}/><meshStandardMaterial emissive="#ffb05b" emissiveIntensity={2} color="#c99a66"/></mesh>)}
  </group>;
}

function OrbitalSky({themeId}:{themeId:ThemeId}) {
  const root=useRef<THREE.Group>(null);
  const planet=useMemo(()=>getSurfaceTextures("planet"),[]);
  const steel=useMemo(()=>getSurfaceTextures("steel"),[]);
  const ribs=useMemo(()=>{
    const parts=Array.from({length:28},(_,i)=>{
      const a=i/28*Math.PI*1.58;
      const g=new THREE.BoxGeometry(.65,.15,.8);
      g.rotateZ(a);g.translate(Math.cos(a)*9,Math.sin(a)*9,0);return g;
    });
    const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geometry;
  },[]);
  useFrame(({camera})=>{
    if(!root.current)return;
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
  });
  const glow=useMemo(()=>({color:{value:new THREE.Color(themeId==="abyss"?"#a8dfe8":"#bed1e7")}}),[themeId]);
  const planetUniforms=useMemo(()=>({map:{value:planet.map},tint:{value:new THREE.Color(themeId==="sky"?"#c5b398":"#9eafc7")}}),[planet,themeId]);
  return <group ref={root}>
    <mesh position={[11,6,-46]} rotation={[.3,0,.2]}>
      <sphereGeometry args={[15,48,32]}/>
      <shaderMaterial uniforms={planetUniforms}
        vertexShader={"varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"}
        fragmentShader={"uniform sampler2D map;uniform vec3 tint;varying vec2 vUv;varying vec3 vN;void main(){float lit=smoothstep(-.25,.75,dot(normalize(vN),normalize(vec3(-.55,.7,.65))));vec3 surface=texture2D(map,vUv).rgb*tint;gl_FragColor=vec4(surface*(.08+lit*1.3),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}"} />
    </mesh>
    <mesh position={[11,6,-46]} scale={1.025}>
      <sphereGeometry args={[15,48,32]}/>
      <shaderMaterial transparent depthWrite={false} side={THREE.BackSide} uniforms={glow}
        vertexShader={"varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=-p.xyz;gl_Position=projectionMatrix*p;}"}
        fragmentShader={"uniform vec3 color;varying vec3 n;varying vec3 v;void main(){float a=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(color,a*.65);}"} />
    </mesh>
    <group position={[-7,4.5,-25]} rotation={[0,.2,-.12]}>
      <mesh><torusGeometry args={[9,.34,8,100,Math.PI*1.58]}/><meshStandardMaterial {...steel} color="#8c999c" metalness={.87} roughness={.64} fog={false}/></mesh>
      <mesh position={[0,0,.12]}><torusGeometry args={[8.6,.075,6,100,Math.PI*1.58]}/><meshStandardMaterial color="#b8bbae" metalness={.8} roughness={.54} fog={false}/></mesh>
      <mesh geometry={ribs} dispose={null}><meshStandardMaterial {...steel} color="#56676d" metalness={.8} roughness={.64} fog={false}/></mesh>
    </group>
  </group>;
}

function ForegroundHardware() {
  const steel=useMemo(()=>getSurfaceTextures("steel"),[]);
  const hazard=useMemo(()=>getSurfaceTextures("hazard"),[]);
  return <group>
    <mesh position={[0,-.3,4.7]} rotation={[.2,0,0]}><boxGeometry args={[2.2,.2,1.2]}/><meshStandardMaterial {...steel} color="#545b58" metalness={.77} roughness={.66}/></mesh>
    <mesh position={[0,-.08,4.7]} rotation={[-Math.PI/2+.2,0,0]}><planeGeometry args={[1.8,.78]}/><meshStandardMaterial color="#101b1f" metalness={.55} roughness={.8}/></mesh>
    <mesh position={[0,-.03,5.17]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.8,.12]}/><meshStandardMaterial {...hazard} color="#b3a081" metalness={.55} roughness={.8}/></mesh>
    {Array.from({length:9},(_,i)=><mesh key={i} position={[-.72+i*.18,-.035,4.7]} rotation={[.2,0,0]}><boxGeometry args={[.025,.025,.68]}/><meshStandardMaterial color="#6d7974" metalness={.8} roughness={.65}/></mesh>)}
    {[-1,1].map(side=><group key={side} position={[side*3.3,-.35,4.7]} rotation={[.12,0,side*.16]}>
      <mesh position={[0,.53,0]}><cylinderGeometry args={[.24,.3,1.05,18]}/><meshStandardMaterial {...steel} color="#817759" metalness={.78} roughness={.63}/></mesh>
      <mesh position={[0,1.22,0]}><coneGeometry args={[.24,.43,18]}/><meshStandardMaterial {...steel} color="#afb19f" metalness={.87} roughness={.38}/></mesh>
      <mesh position={[0,.09,0]}><cylinderGeometry args={[.32,.32,.14,18]}/><meshStandardMaterial color="#b69c60" metalness={.8} roughness={.45}/></mesh>
    </group>)}
    <mesh position={[1.8,-.35,4.1]} rotation={[Math.PI/2,0,.2]}><torusGeometry args={[.65,.058,8,36,Math.PI*1.65]}/><meshStandardMaterial color="#181d1c" roughness={.92}/></mesh>
  </group>;
}

export function ThemeEnvironment({themeId}:ThemeEnvironmentProps) {
  const ground=useMemo(()=>getSurfaceTextures("ground"),[]);
  const steel=useMemo(()=>getSurfaceTextures("steel"),[]);
  const terrain=useMemo(terrainGeometry,[]);
  const rubble=useMemo(rubbleGeometry,[]);
  return <>
    <fog attach="fog" args={[themeId==="sky"?"#303031":"#242c35",22,70]}/>
    <Stars radius={90} depth={30} count={650} factor={1.3} saturation={0} fade/>
    <OrbitalSky themeId={themeId}/>
    <Environment resolution={64} frames={1}>
      <Lightformer intensity={2.4} color="#d9e4ed" position={[0,7,3]} rotation={[-Math.PI/2,0,0]} scale={[12,8,1]}/>
      <Lightformer intensity={1.1} color="#ebb77b" position={[-7,3,-3]} rotation={[0,Math.PI/2,0]} scale={[5,5,1]}/>
    </Environment>
    <ambientLight intensity={.55} color="#abb7c5"/>
    <hemisphereLight args={["#b5ccdf","#302b23",1.15]}/>
    <directionalLight castShadow position={[-7,12,6]} intensity={3.1} color="#f1dfbe" shadow-mapSize={[1024,1024]} shadow-bias={-.001} shadow-normalBias={.035} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10}/>
    <directionalLight position={[8,5,-10]} intensity={2.1} color="#b5d3f0"/>
    <mesh geometry={terrain} receiveShadow dispose={null}><meshStandardMaterial {...ground} color={themeId==="abyss"?"#898e8e":"#8e8c83"} roughness={.98} bumpScale={.055}/></mesh>
    <mesh geometry={rubble} receiveShadow dispose={null}><meshStandardMaterial {...ground} color="#777b78" roughness={1} bumpScale={.08}/></mesh>
    <FortressGun/>
    {[[-7,-6.5,1.1],[3.8,-6.5,1.15],[5.2,-7.7,1.3],[-3,-7.5,.65],[1.8,-7,.65],[-4,-7.8,.7],[3.1,-7.8,.7]].map(([x,z,s],i)=><Building key={i} position={[x,-.65,z]} scale={s} variant={i}/>)}
    <ForegroundHardware/>
    {[-1,1].map(side=><group key={side} position={[side*3.8,-.38,2.1]}>
      <mesh receiveShadow castShadow><boxGeometry args={[.42,.65,1.35]}/><meshStandardMaterial {...steel} color="#6a746f" metalness={.68} roughness={.77} bumpScale={.025}/></mesh>
      <mesh position={[-side*.18,.36,0]} rotation={[0,0,side*.18]}><boxGeometry args={[.18,.09,1.5]}/><meshStandardMaterial color="#9f9e87" metalness={.8} roughness={.5}/></mesh>
      <mesh position={[-side*.24,.12,.45]}><boxGeometry args={[.025,.08,.13]}/><meshStandardMaterial color="#efbf76" emissive="#ffac49" emissiveIntensity={2}/></mesh>
    </group>)}
    <pointLight position={[-4,1.3,-4]} intensity={7} color="#ffb569" distance={6}/>
  </>;
}
