"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { Group, OrthographicCamera, PCFShadowMap } from "three";
import type { Person } from "@/lib/types";
import { TERRAIN_DEPTH } from "@/lib/render3d";
import { useMotionAllowed } from "@/lib/motion";
import { characterCells, houseCells, placements, type Placement } from "@/lib/scene-layout";
import {
  BenchModel, CharacterModel, FlowerPatchModel, GroundDetailsModel, HouseModel, LampModel,
  MailboxModel, PathModel, ShrubModel, TableModel, TreeModel,
} from "./PlaneModels";

const top = { grass: "#aecb82", stone: "#dfddd5", earth: "#dabb8e", sand: "#ebdcc2" };
const side = { grass: "#9a775c", stone: "#8f8985", earth: "#9a7356", sand: "#a98262" };

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

function EnvironmentObject({ placement, index }: { placement: Placement; index: number }) {
  if (placement.kind === "tree") return <TreeModel variant={placement.variant}/>;
  if (placement.kind === "bush") return <ShrubModel/>;
  if (placement.kind === "flowers") return <FlowerPatchModel/>;
  if (placement.kind === "path") return <PathModel variant={index}/>;
  if (placement.kind === "bench") return <BenchModel/>;
  if (placement.kind === "mailbox") return <MailboxModel/>;
  if (placement.kind === "lamp") return <LampModel/>;
  if (placement.kind === "table") return <TableModel/>;
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
    <Canvas orthographic camera={{ position: [4.8, 3.7, 5.8], zoom: 180, near: .1, far: 40 }} shadows={{ type: PCFShadowMap }} dpr={[1, 1.6]}>
      <color attach="background" args={["#bfe8ff"]}/><Lights/><ResponsiveCamera kind="character"/>
      <group position={[0, -.5, 0]}><IdleCharacter person={person} large/><ContactShadows position={[0, .02, 0]} opacity={.3} scale={3.2} blur={2.4} far={2}/></group>
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3.1} maxPolarAngle={Math.PI / 2.25} target={[0,.25,0]}/>
    </Canvas>
    <span className="preview-hint">Drag to turn</span>
  </div>;
}

function Land({ person }: { person: Person }) {
  const house = houseCells[person.scene];
  const character = characterCells[person.scene];
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
    <group position={[house.tileX+1,0,house.tileY+1]}><HouseModel home={person.home} houseColor={person.houseColor}/></group>
    {placements[person.scene].map((item,index)=><group key={`${item.kind}-${index}`} position={[item.tileX+.5,0,item.tileY+.5]}><EnvironmentObject placement={item} index={index}/></group>)}
    <group position={[character.tileX+.5,0,character.tileY+.5]}><IdleCharacter person={person}/></group>
  </group>;
}

export function LandPreview3D({ person }: { person: Person }) {
  return <div className="three-preview land-preview" aria-label="Live 5 by 5 land preview">
    <Canvas orthographic camera={{ position: [8.7, 8.2, 9.5], zoom: 80, near: .1, far: 60 }} shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]}>
      <color attach="background" args={["#bfe8ff"]}/><Lights/><ResponsiveCamera kind="land"/><Land person={person}/><ContactShadows position={[0,-.46,0]} opacity={.2} scale={10} blur={3} far={4}/>
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} target={[0,.95,0]}/>
    </Canvas>
  </div>;
}
