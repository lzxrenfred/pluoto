"use client";

import { Canvas, createRoot, extend, useFrame, useThree, type ReconcilerRoot } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Group, OrthographicCamera, PCFShadowMap } from "three";
import type { Person } from "@/lib/types";
import { TERRAIN_DEPTH } from "@/lib/render3d";
import { IDLE_FRAME_MS, useMotionAllowed } from "@/lib/motion";
import { appearanceKey } from "@/lib/customization";
import { characterCellForPerson, landObjectsForPerson, signCellForPerson, signModelZ } from "@/lib/land-objects";
import { CharacterModel, GroundDetailsModel } from "./PlaneModels";
import { LandObjectInstance } from "./LandObjects3D";
import { LandSignModel } from "./LandSignModel";

const top = { grass: "#aecb82", stone: "#dfddd5", earth: "#dabb8e", sand: "#ebdcc2", meadow: "#a8c894", clay: "#c99680" };
const side = { grass: "#9a775c", stone: "#8f8985", earth: "#9a7356", sand: "#a98262", meadow: "#8e795d", clay: "#9b6b5a" };

function Lights() {
  return <><ambientLight intensity={1.35}/><hemisphereLight args={["#dff3ff", "#8d765f", 1.15]}/><directionalLight castShadow position={[-5, 9, 5]} intensity={2.1} shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6}/></>;
}

function ResponsiveCamera({kind}:{kind:"character"|"land"}) {
  const {camera,size}=useThree();
  useEffect(()=>{
    const ortho=camera as OrthographicCamera;
    ortho.zoom=kind==="land"?Math.min(size.width/7.7,size.height/5.7):Math.min(size.width/3.15,size.height/2.45);
    ortho.updateProjectionMatrix();
  },[camera,kind,size.height,size.width]);
  return null;
}

/**
 * The character preview renders on demand but keeps breathing: idle frames at ~10fps, dragging at full rate.
 * ponytail: the land preview stays still; ~400 unbaked draws a frame is too much to spend on a tiny breathing animal.
 */
function IdleFrames() {
  const invalidate = useThree((state) => state.invalidate);
  const motionAllowed = useMotionAllowed();
  useEffect(() => {
    if (!motionAllowed) return;
    const timer = window.setInterval(invalidate, IDLE_FRAME_MS);
    return () => window.clearInterval(timer);
  }, [invalidate, motionAllowed]);
  return null;
}

function IdleCharacter({ person, large = false }: { person: Person; large?: boolean }) {
  const ref = useRef<Group>(null);
  const motionAllowed = useMotionAllowed();
  useFrame(({ clock }) => {
    if (!ref.current || !motionAllowed) return;
    const breath = 1 + Math.sin(clock.elapsedTime * .86) * .014;
    ref.current.scale.setScalar(breath);
    ref.current.rotation.y = Math.sin(clock.elapsedTime * .25) * .08;
  });
  return <group ref={ref} scale={large ? 1.7 : 1}><CharacterModel person={person}/></group>;
}

export function CharacterPreview3D({ person }: { person: Person }) {
  return <div className="three-preview character-preview" aria-label="Live 3D Character preview">
    <Canvas frameloop="demand" orthographic camera={{ position: [4.8, 3.7, 5.8], zoom: 180, near: .1, far: 40 }} shadows={{ type: PCFShadowMap }} dpr={[1, 1.6]}>
      <color attach="background" args={["#bfe8ff"]}/><Lights/><ResponsiveCamera kind="character"/><IdleFrames/>
      <group position={[0, -.5, 0]}><IdleCharacter person={person} large/><ContactShadows position={[0, .02, 0]} opacity={.3} scale={3.2} blur={2.4} far={2}/></group>
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3.1} maxPolarAngle={Math.PI / 2.25} target={[0,.25,0]}/>
    </Canvas>
    <span className="preview-hint">Drag to turn</span>
  </div>;
}

// Small avatars are still images. One shared offscreen renderer draws each look once, so a long friend list
// holds no live WebGL canvases (browsers keep only ~16 per page, fewer on phones).
const SNAPSHOT_PX = 192;
const FRAMINGS = {
  // The old live header portrait: 50px box at zoom 43.
  portrait: { camera: [2, 2.7, 5.8], target: [0, .18, 0], view: 50 / 43, groupY: -.42, scale: 1.2, ambient: 1.45, sky: "#fff7e7", hemisphere: 1.25, sun: [-4, 7, 6], sunIntensity: 2, blob: false },
  // The old live friend-row preview (CharacterPreview3D framing, sized to the box width).
  tile: { camera: [4.8, 3.7, 5.8], target: [0, .25, 0], view: 3.15, groupY: -.5, scale: 1.7, ambient: 1.35, sky: "#dff3ff", hemisphere: 1.15, sun: [-5, 9, 5], sunIntensity: 2.1, blob: true },
} as const;
type Framing = keyof typeof FRAMINGS;
let snapshotRoot: ReconcilerRoot<HTMLCanvasElement> | null = null;
let snapshotQueue: Promise<unknown> = Promise.resolve();
const snapshots = new Map<string, Promise<string>>();

function SnapshotScene({ person, framing, onReady }: { person: Person; framing: Framing; onReady: () => void }) {
  const look = FRAMINGS[framing];
  useLayoutEffect(onReady, [onReady]);
  return <>
    <ambientLight intensity={look.ambient}/><hemisphereLight args={[look.sky, "#8d765f", look.hemisphere]}/><directionalLight position={[...look.sun]} intensity={look.sunIntensity}/>
    <group position={[0, look.groupY, 0]}>
      {look.blob && <mesh position={[0, .02, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.55, 32]}/><meshBasicMaterial color="#3d5a4a" transparent opacity={.16} depthWrite={false}/></mesh>}
      <group scale={look.scale}><CharacterModel person={person}/></group>
    </group>
  </>;
}

async function renderSnapshot(person: Person, framing: Framing) {
  const look = FRAMINGS[framing];
  if (!snapshotRoot) {
    extend(THREE as never); // <Canvas> registers three's classes; this root renders outside any Canvas.
    snapshotRoot = createRoot(document.createElement("canvas"));
  }
  const root = snapshotRoot;
  await root.configure({ frameloop: "never", orthographic: true, dpr: 1, size: { width: SNAPSHOT_PX, height: SNAPSHOT_PX, top: 0, left: 0 },
    camera: { near: .1, far: 40 }, gl: { alpha: true, antialias: true, preserveDrawingBuffer: true } });
  let store: ReturnType<typeof root.render> | undefined;
  await new Promise<void>((resolve) => { store = root.render(<SnapshotScene key={framing + appearanceKey(person)} person={person} framing={framing} onReady={resolve}/>); });
  const { gl, scene, camera } = store!.getState();
  const ortho = camera as OrthographicCamera;
  ortho.position.fromArray(look.camera); ortho.zoom = SNAPSHOT_PX / look.view; ortho.lookAt(look.target[0], look.target[1], look.target[2]); ortho.updateProjectionMatrix();
  gl.render(scene, ortho);
  return gl.domElement.toDataURL("image/png");
}

/** Image URL for this Character's look, rendered once and shared by every component that asks. */
function useSnapshot(person: Person, framing: Framing) {
  const key = `${framing}:${appearanceKey(person)}`;
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    if (!snapshots.has(key)) {
      const next = snapshotQueue.then(() => renderSnapshot(person, framing));
      snapshotQueue = next.catch(() => undefined);
      snapshots.set(key, next);
    }
    snapshots.get(key)!.then((value) => { if (live) setUrl(value); }, () => undefined);
    return () => { live = false; };
  }, [key]); // key covers every field that changes the picture
  return url;
}

/** Header avatar. */
export function CharacterPortrait3D({ person }: { person: Person }) {
  const url = useSnapshot(person, "portrait");
  return <div className="character-portrait-3d" aria-hidden="true">{url && <img src={url} alt="" style={{ display: "block", width: "100%", height: "100%" }}/>}</div>;
}

/** Friend-list avatar, framed like the live preview it replaces. */
export function CharacterTile({ person }: { person: Person }) {
  const url = useSnapshot(person, "tile");
  return <div className="three-preview character-preview" aria-hidden="true">{url && <img src={url} alt="" style={{ display: "block", width: "100%", height: "100%" }}/>}</div>;
}

function Land({ person }: { person: Person }) {
  const character = characterCellForPerson(person);
  const sign=signCellForPerson(person);
  return <group position={[-2.5, 0, -2.5]}>
    {Array.from({ length: 25 }, (_, index) => {
      const x = index % 5, z = Math.floor(index / 5);
      return <group key={index}>
        <mesh position={[x + .5, 0, z + .5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1,1]}/><meshStandardMaterial color={top[person.ground]} roughness={.94}/></mesh>
        {z===0&&<mesh position={[x+.5,-TERRAIN_DEPTH/2,0]}><boxGeometry args={[1,TERRAIN_DEPTH,.025]}/><meshStandardMaterial color={side[person.ground]} roughness={1}/></mesh>}
        {z===4&&<mesh position={[x+.5,-TERRAIN_DEPTH/2,5]}><boxGeometry args={[1,TERRAIN_DEPTH,.025]}/><meshStandardMaterial color={side[person.ground]} roughness={1}/></mesh>}
        {x===0&&<mesh position={[0,-TERRAIN_DEPTH/2,z+.5]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[1,TERRAIN_DEPTH,.025]}/><meshStandardMaterial color={side[person.ground]} roughness={1}/></mesh>}
        {x===4&&<mesh position={[5,-TERRAIN_DEPTH/2,z+.5]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[1,TERRAIN_DEPTH,.025]}/><meshStandardMaterial color={side[person.ground]} roughness={1}/></mesh>}
      </group>;
    })}
    <GroundDetailsModel/>
    {landObjectsForPerson(person).map(object=><LandObjectInstance key={object.id} object={object} person={person}/>)}
    <group position={[sign.tileX+.5,0,signModelZ(sign)]} rotation={[0,Math.PI/4,0]}><LandSignModel nickname={person.nickname}/></group>
    <group position={[character.tileX+.5,0,character.tileY+.5]}><IdleCharacter person={person}/></group>
  </group>;
}

export function LandPreview3D({ person }: { person: Person }) {
  return <div className="three-preview land-preview" aria-label="Live 5 by 5 land preview">
    <Canvas frameloop="demand" orthographic camera={{ position: [8.7, 8.2, 9.5], zoom: 80, near: .1, far: 60 }} shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]}>
      <color attach="background" args={["#bfe8ff"]}/><Lights/><ResponsiveCamera kind="land"/><Land person={person}/><ContactShadows position={[0,-.46,0]} opacity={.2} scale={10} blur={3} far={4}/>
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} target={[0,.95,0]}/>
    </Canvas>
  </div>;
}
