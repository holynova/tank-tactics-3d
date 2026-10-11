"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Crosshair, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CombatFx } from "../../game/use-game-controller";
import type { Piece, Position, ThemeId } from "../../game/types";
import { THEMES } from "../../game/themes";
import { GameUnit, type UnitMotionState } from "./UnitModels";
import { ThemeEnvironment } from "./ThemeEnvironment";
import { getDamageTexture, getParticleTexture, getSurfaceTextures } from "./industrial-materials";
import { DECK_TILE, DeckPlatform } from "./DeckPlatform";
import { AIM_SECONDS, MOVE_TRAVEL_SECONDS, MOVE_TURN_SECONDS, PROJECTILE_SECONDS } from "../../game/animation";
import { buildShotCues } from "../../game/combat-presentation";
import { ArtilleryCameraFeedback, ArtilleryImpact } from "./ArtilleryImpact";

const CELL_GAP = 1.42;

function worldPosition(position: Position): [number, number, number] {
  return [(position.col - 1.5) * CELL_GAP, .085, (position.row - 1.5) * CELL_GAP];
}

function AnimatedUnit({
  piece,
  themeId,
  selected,
  disabled,
  firing,
  fireDelay,
  aimTarget,
  onPress,
}: {
  piece: Piece;
  themeId: ThemeId;
  selected: boolean;
  disabled: boolean;
  firing: boolean;
  fireDelay: number;
  aimTarget: Position | null;
  onPress: (position: Position) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(...worldPosition(piece)), [piece]);
  const targetRotation = THREE.MathUtils.degToRad(180 - piece.facing);
  const [origin] = useState(() => ({
    position: new THREE.Vector3(...worldPosition(piece)),
    rotation: [0, targetRotation, 0] as [number, number, number],
  }));
  const motion = useRef<UnitMotionState>({moving:false,turning:false,phase:0,travel:0,turn:targetRotation});
  const journey = useRef({
    key: `${piece.row}/${piece.col}/${piece.facing}`, start:0, active:false,
    from:origin.position.clone(), yaw:targetRotation, yawDelta:0, distance:0, travelled:0,
  });
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const aimAngle = useMemo(() => {
    if (!aimTarget) return 0;
    const [fromX, , fromZ] = worldPosition(piece);
    const [toX, , toZ] = worldPosition(aimTarget);
    return Math.atan2(toX - fromX, toZ - fromZ) - targetRotation;
  }, [aimTarget, piece, targetRotation]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const key = `${piece.row}/${piece.col}/${piece.facing}`;
    const j = journey.current;
    if(j.key !== key) {
      j.key=key; j.start=clock.elapsedTime; j.active=true;
      j.from.copy(group.current.position); j.yaw=group.current.rotation.y;
      j.yawDelta=Math.atan2(Math.sin(targetRotation-j.yaw),Math.cos(targetRotation-j.yaw));
      j.distance=j.from.distanceTo(target);
    }
    if(!j.active)return;
    const elapsed=clock.elapsedTime-j.start;
    const turnSeconds=reduced ? .08 : MOVE_TURN_SECONDS;
    const travelSeconds=reduced ? .18 : MOVE_TRAVEL_SECONDS;
    const turn=THREE.MathUtils.clamp(elapsed/turnSeconds,0,1);
    const progress=THREE.MathUtils.clamp((elapsed-turnSeconds)/travelSeconds,0,1);
    const eased=progress*progress*(3-2*progress);
    group.current.rotation.y=j.yaw+j.yawDelta*turn*turn*(3-2*turn);
    group.current.position.copy(j.from).lerp(target,eased);
    const moving=progress>0&&progress<1;
    const walker=Number(piece.id.split("-").at(-1))%2===1;
    if(moving&&!reduced)group.current.position.y+=Math.sin(progress*Math.PI)*Math.sin(progress*Math.PI*(walker?6:8))*(walker ? .035 : .009);
    motion.current.moving=moving&&!reduced;
    motion.current.turning=!reduced&&turn<1&&Math.abs(j.yawDelta)>.05;
    motion.current.phase=progress;
    motion.current.travel=j.travelled+j.distance*eased;
    motion.current.turn=group.current.rotation.y;
    if(progress>=1){j.active=false;j.travelled=motion.current.travel;}
  });

  return (
    <group
      ref={group}
      position={origin.position}
      rotation={origin.rotation}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled && event.delta < 6) onPress({ row: piece.row, col: piece.col });
      }}
    >
      {/* Body-sized picking proxy keeps decorative long barrels from blocking adjacent empty cells. */}
      <mesh position={[0,.38,0]}>
        <boxGeometry args={[1.1,.8,1.1]}/>
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false}/>
      </mesh>
      <GameUnit
        themeId={themeId}
        color={piece.color}
        selected={selected}
        disabled={disabled}
        variant={Number(piece.id.split("-").at(-1)) || 0}
        aimAngle={aimAngle}
        firing={firing}
        fireDelay={fireDelay}
        motion={motion}
      />
      <MovementDust motion={motion} />
    </group>
  );
}

function MovementDust({ motion }: { motion: React.RefObject<UnitMotionState> }) {
  const root=useRef<THREE.Group>(null);
  const puffs=useRef<Array<THREE.Sprite|null>>([]);
  const map=useMemo(()=>getParticleTexture("smoke"),[]);
  useFrame(({clock})=>{
    if(!root.current)return;
    const state=motion.current;
    root.current.visible=state.moving;
    puffs.current.forEach((sprite,i)=>{
      if(!sprite)return;
      const age=(clock.elapsedTime*2.5+i*.31)%1;
      sprite.position.set((i%2?1:-1)*(.35+age*.12),.03+age*.12,-.48-age*.4);
      sprite.scale.setScalar(.26+age*.5);
      sprite.material.opacity=.22*(1-age)*Math.sin(state.phase*Math.PI);
    });
  });
  return <group ref={root} visible={false}>
    {Array.from({length:4},(_,i)=><sprite key={i} ref={sprite=>{puffs.current[i]=sprite;}} raycast={()=>undefined}>
      <spriteMaterial map={map} color="#b0a58e" transparent opacity={0} depthWrite={false}/>
    </sprite>)}
  </group>;
}

function Cell({
  position,
  themeId,
  valid,
  selected,
  last,
  scar,
  disabled,
  onPress,
}: {
  position: Position;
  themeId: ThemeId;
  valid: boolean;
  selected: boolean;
  last: boolean;
  scar: boolean;
  disabled: boolean;
  onPress: (position: Position) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const theme = THEMES[themeId];
  const deck = useMemo(() => getSurfaceTextures("deck"), []);
  const burn = useMemo(() => getDamageTexture(), []);
  const [x, , z] = worldPosition(position);
  const raised = 0;

  return (
    <group position={[x, raised, z]}>
      <mesh
        receiveShadow
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        geometry={DECK_TILE}
        dispose={null}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled && event.delta < 6) onPress(position);
        }}
      >
        <meshStandardMaterial
          {...deck}
          color={valid ? "#c6a267" : scar ? "#747267" : "#a6a69b"}
          emissive={valid ? theme.accent : last ? theme.blue : "#000000"}
          emissiveIntensity={valid ? (hovered ? 0.72 : 0.36) : last ? 0.18 : 0}
          roughness={0.77}
          metalness={0.55}
          bumpScale={0.023}
        />
      </mesh>
      {scar&&<mesh position={[0,.096,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>undefined}>
        <planeGeometry args={[1.22,1.22]}/>
        <meshStandardMaterial map={burn} bumpMap={burn} bumpScale={.026} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} roughness={.99} metalness={.1}/>
      </mesh>}
      <mesh position={[0, -0.015, 0]}>
        <boxGeometry args={[1.13, 0.015, 1.13]} />
        <meshStandardMaterial color="#141d29" roughness={0.7} metalness={0.48} />
      </mesh>
      {valid && (
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.16, 0.25, 24]} />
          <meshBasicMaterial color={theme.accent} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.46, 0.56, 36]} />
          <meshBasicMaterial color={theme.accent} transparent opacity={0.86} toneMapped={false} />
        </mesh>
      )}
      {last && !selected && (
        <mesh position={[0.45, 0.1, 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.055, 14]} />
          <meshBasicMaterial color={theme.blue} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

interface Shot {
  id: string;
  from: THREE.Vector3;
  to: THREE.Vector3;
  accent: string;
  delay: number;
}

const SHELL_FORWARD = new THREE.Vector3(0, 0, 1);

function CannonShell({ shot, reducedMotion }: { shot: Shot; reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAt.current - shot.delay;
    if (!root.current || elapsed < 0) {
      if (root.current) root.current.visible = false;
      return;
    }
    root.current.visible = true;
    const duration = reducedMotion ? 0.36 : PROJECTILE_SECONDS;
    const progress = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
    root.current.visible = progress < 1;
    const distance = shot.from.distanceTo(shot.to);
    const height = Math.min(.75, distance * .12) + .28;
    root.current.position.copy(shot.from).lerp(shot.to, progress);
    root.current.position.y += Math.sin(progress * Math.PI) * height;
    velocity.current.copy(shot.to).sub(shot.from);
    velocity.current.y += height * Math.PI * Math.cos(progress * Math.PI);
    direction.current.copy(velocity.current).normalize();
    root.current.quaternion.setFromUnitVectors(SHELL_FORWARD, direction.current);
    if (glow.current) {
      const fade = progress > 0.9 ? 1 - (progress - 0.9) * 9 : 1;
      (glow.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fade * 0.72);
    }
  });

  return (
    <group ref={root} position={shot.from.toArray()}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.22, 8]} />
        <meshStandardMaterial color="#e5b762" emissive="#98420f" emissiveIntensity={0.62} metalness={0.84} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0, 0.145]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.12, 8]} />
        <meshStandardMaterial color="#fbe1a2" emissive="#ad5421" emissiveIntensity={0.42} metalness={0.56} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0, -0.145]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.047, 0.047, 0.045, 8]} />
        <meshStandardMaterial color="#292b2c" metalness={0.74} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0, -0.19]} ref={glow} scale={[0.055, 0.055, 0.12]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ff9d4c" transparent opacity={0.48} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <pointLight color="#ff9a45" intensity={1.6} distance={1.05} decay={2} />
    </group>
  );
}

function MuzzleFlash({ shot }: { shot: Shot }) {
  const flare = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);
  const light = useRef<THREE.PointLight>(null);
  const pressure=useRef<THREE.Mesh>(null);
  const gas=useRef<Array<THREE.Sprite|null>>([]);
  const smoke=useMemo(()=>getParticleTexture("smoke"),[]);
  const map = useMemo(()=>getParticleTexture("glow"),[]);
  const startedAt = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    if (!flare.current) return;
    const elapsed = clock.elapsedTime - startedAt.current - shot.delay;
    const progress = Math.max(0, elapsed / .16);
    const visible = elapsed >= 0 && progress < 1;
    flare.current.visible = visible;
    flare.current.scale.set(.65+progress*.8,.8+progress*1.6,.65+progress*.8);
    (flare.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress);
    if(halo.current){halo.current.visible=visible;halo.current.scale.setScalar(1.05+progress*.9);halo.current.material.opacity=Math.max(0,1-progress)*.95;}
    if(light.current)light.current.intensity=visible?24*Math.exp(-progress*5):0;
    if(pressure.current){pressure.current.visible=elapsed>=0&&elapsed<.3;pressure.current.scale.setScalar(.3+Math.max(0,elapsed)*4);(pressure.current.material as THREE.MeshBasicMaterial).opacity=.65*Math.max(0,1-elapsed/.3);}
    gas.current.forEach((sprite,i)=>{
      if(!sprite)return;
      const age=Math.max(0,elapsed-i*.025),life=.65;
      sprite.visible=elapsed>=i*.025&&age<life;
      sprite.position.set((i%2?1:-1)*age*.38,.04+age*.3,.12+age*(1.1+i*.16));
      sprite.scale.setScalar(.18+age*.9);
      sprite.material.opacity=.62*Math.max(0,1-age/life);
    });
  });
  const direction = shot.to.clone().sub(shot.from);
  const angle = Math.atan2(direction.x, direction.z);
  const position = shot.from.clone().add(direction.normalize().multiplyScalar(0.18));
  position.y += 0.01;
  return (
    <group position={position} rotation={[0, angle, 0]}>
      <mesh ref={flare} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.21, 0.64, 9]} />
        <meshBasicMaterial color="#ffcf7a" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <sprite ref={halo} visible={false}><spriteMaterial map={map} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/></sprite>
      <mesh ref={pressure} position={[0,0,.1]} visible={false}><ringGeometry args={[.2,.225,32]}/><meshBasicMaterial color="#ffda9d" transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false}/></mesh>
      {Array.from({length:4},(_,i)=><sprite key={i} ref={sprite=>{gas.current[i]=sprite;}} visible={false}><spriteMaterial map={smoke} color="#b7ac95" transparent depthWrite={false}/></sprite>)}
      <pointLight ref={light} color="#ffb469" intensity={0} distance={4} decay={2} />
    </group>
  );
}


function DamageDebris({scars}:{scars:Position[]}) {
  const chunks=useRef<THREE.InstancedMesh>(null);
  useEffect(()=>{
    const dummy=new THREE.Object3D();
    scars.forEach((scar,scarIndex)=>{
      const [x,,z]=worldPosition(scar);
      for(let i=0;i<6;i++){
        const angle=i*2.399+scarIndex, radius=.24+(i%3)*.075;
        dummy.position.set(x+Math.cos(angle)*radius,.12,z+Math.sin(angle)*radius);
        dummy.rotation.set(i*.41,angle,i*.26);
        dummy.scale.set(.045+(i%2)*.025,.025,.065);
        dummy.updateMatrix();chunks.current?.setMatrixAt(scarIndex*6+i,dummy.matrix);
      }
    });
    if(chunks.current)chunks.current.instanceMatrix.needsUpdate=true;
  },[scars]);
  if(!scars.length)return null;
  return <instancedMesh ref={chunks} args={[undefined,undefined,scars.length*6]} raycast={()=>undefined} receiveShadow>
    <dodecahedronGeometry args={[1,0]}/><meshStandardMaterial color="#49483e" metalness={.66} roughness={.79}/>
  </instancedMesh>;
}

function AttackEffects({ pieces, fx, themeId, reducedMotion }: {
  pieces: Piece[];
  fx: CombatFx;
  themeId: ThemeId;
  reducedMotion: boolean;
}) {
  const theme = THEMES[themeId];
  const shots = buildShotCues(pieces,fx.attackerIds,fx.victimIds).map(({attacker,victim,id,delay}) => {
      const from = new THREE.Vector3(...worldPosition(attacker));
      const to = new THREE.Vector3(...worldPosition(victim));
      const walker = Number(attacker.id.split("-").at(-1)) % 2 === 1;
      from.y = walker ? .89 : .7;
      to.y = .48;
      const heading = to.clone().sub(from);
      const direction = heading.clone().setY(0).normalize();
      from.addScaledVector(direction, walker ? .85 : 1.15);
      return {
        id,
        from,
        to,
        accent: attacker.color === "red" ? theme.red : theme.blue,
        delay,
      } satisfies Shot;
  });

  return (
    <>
      {shots.map((shot) => <CannonShell key={shot.id} shot={shot} reducedMotion={reducedMotion} />)}
      {shots.map((shot) => <MuzzleFlash key={`muzzle-${shot.id}`} shot={shot} />)}
      {fx.burstPositions.map((position, index) => {
        const [x, , z] = worldPosition(position);
        return (
          <ArtilleryImpact
            key={`${position.row}-${position.col}-${index}`}
            position={[x, 0.54, z]}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </>
  );
}

export interface CameraCommands {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

interface GameBoard3DProps {
  pieces: Piece[];
  scars?: Position[];
  selectedId: string | null;
  validMoves: Position[];
  themeId: ThemeId;
  lastMove: Position | null;
  fx: CombatFx;
  disabled: boolean;
  onCellPress: (position: Position) => void;
  cameraEnabled?: boolean;
}

function CameraRig({ controls }: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree(state => state.camera);
  const mobile = useThree(state => state.size.width < 620);
  useEffect(() => {
    camera.position.set(...(mobile ? [0, 14.6, 11.7] : [7.5, 12.5, 12.5]) as [number, number, number]);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = mobile ? 46 : 38;
      camera.updateProjectionMatrix();
    }
    controls.current?.target.set(0, 0, mobile ? .5 : -.5);
    controls.current?.update();
    controls.current?.saveState();
  }, [camera, mobile, controls]);
  return null;
}

function RenderProbe() {
  const last = useRef(0);
  const frames = useRef(0);
  useFrame(({ gl, clock }) => {
    frames.current++;
    if (clock.elapsedTime - last.current < 1) return;
    const elapsed = clock.elapsedTime - last.current;
    last.current = clock.elapsedTime;
    gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
    gl.domElement.dataset.triangles = String(gl.info.render.triangles);
    gl.domElement.dataset.textureCount = String(gl.info.memory.textures);
    gl.domElement.dataset.fps = String(Math.round(frames.current / elapsed));
    frames.current = 0;
  });
  return null;
}

export function GameBoard3D({
  pieces,
  scars = [],
  selectedId,
  validMoves,
  themeId,
  lastMove,
  fx,
  disabled,
  onCellPress,
  cameraEnabled = true,
}: GameBoard3DProps) {
  const theme = THEMES[themeId];
  const controls = useRef<OrbitControlsImpl>(null);
  const cues=buildShotCues(pieces,fx.attackerIds,fx.victimIds);
  const mobileLayout = typeof window !== "undefined" && window.innerWidth < 620;
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const zoom = (inward: boolean) => {
    const controlsApi = controls.current;
    if (!controlsApi) return;
    // three-stdlib expresses perspective dolly as a radius scale; dollyOut's
    // reciprocal scale brings the camera closer in the pinned Drei version.
    if (inward) controlsApi.dollyOut(1.2);
    else controlsApi.dollyIn(1.2);
    controlsApi.update();
  };

  return (
    <div className="game-board-layer">
      <Canvas
        className="game-canvas"
        dpr={[1, 1.6]}
        shadows
        camera={{
          position: mobileLayout ? [0, 14.6, 11.7] : [7.5, 12.5, 12.5],
          fov: mobileLayout ? 46 : 38,
          near: 0.1,
          far: 180,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
        fallback={<div className="webgl-fallback">请使用支持 WebGL 的浏览器打开战术沙盘。</div>}
        onPointerMissed={() => undefined}
        style={{ background: theme.background }}
      >
        <OrbitControls
          ref={controls}
          enabled={cameraEnabled}
          makeDefault
          enableDamping
          dampingFactor={0.085}
          enablePan
          enableRotate
          enableZoom
          minDistance={10}
          maxDistance={26}
          minPolarAngle={0.24}
          maxPolarAngle={1.37}
          target={[0, 0, mobileLayout ? .5 : -.5]}
          zoomSpeed={0.72}
          rotateSpeed={0.72}
          panSpeed={0.65}
        />
        <CameraRig controls={controls} />
        <RenderProbe />
        <ArtilleryCameraFeedback fx={fx} reducedMotion={reducedMotion}/>
        <color attach="background" args={[theme.background]} />
        <ThemeEnvironment themeId={themeId} />

        <group>
          <DeckPlatform />

          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 4 }, (_, col) => {
              const position = { row, col };
              const piece = pieces.find((candidate) => candidate.row === row && candidate.col === col);
              return (
                <Cell
                  key={`${row}-${col}`}
                  position={position}
                  themeId={themeId}
                  valid={validMoves.some((move) => move.row === row && move.col === col)}
                  selected={piece?.id === selectedId}
                  last={lastMove?.row === row && lastMove?.col === col}
                  scar={scars.some(scar=>scar.row===row&&scar.col===col)}
                  disabled={disabled}
                  onPress={onCellPress}
                />
              );
            }),
          )}

          {pieces.map((piece) => {
            const targets = pieces
              .filter((candidate) => fx.victimIds.includes(candidate.id))
              .sort((a, b) => Math.abs(a.row - piece.row) + Math.abs(a.col - piece.col) - (Math.abs(b.row - piece.row) + Math.abs(b.col - piece.col)));
            const aimTarget = fx.attackerIds.includes(piece.id) ? targets[0] ?? null : null;
            return (
              <AnimatedUnit
                key={piece.id}
                piece={piece}
                themeId={themeId}
                selected={piece.id === selectedId}
                disabled={disabled || fx.victimIds.includes(piece.id)}
                firing={fx.attackerIds.includes(piece.id)}
                fireDelay={cues.find(cue=>cue.attacker.id===piece.id)?.delay??AIM_SECONDS}
                aimTarget={aimTarget}
                onPress={onCellPress}
              />
            );
          })}
          <AttackEffects pieces={pieces} fx={fx} themeId={themeId} reducedMotion={reducedMotion} />
          <DamageDebris scars={scars}/>
        </group>
      </Canvas>

      <div className="camera-controls-rail" role="group" aria-label="战场视角">
        <button type="button" aria-label="重置战场视角" title="重置视角" onClick={() => controls.current?.reset()}>
          <RotateCcw aria-hidden="true" />
        </button>
        <button type="button" aria-label="放大视角" title="放大" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoom(true)}>
          <Plus aria-hidden="true" />
        </button>
        <button type="button" aria-label="缩小视角" title="缩小" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoom(false)}>
          <Minus aria-hidden="true" />
        </button>
        <button type="button" aria-label="聚焦棋盘" title="聚焦棋盘" onClick={() => { controls.current?.target.set(0,0,0); controls.current?.update(); }}>
          <Crosshair aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
