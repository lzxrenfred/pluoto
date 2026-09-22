"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Line, OrbitControls } from "@react-three/drei";
import { Check, RotateCw, Trash2, X } from "lucide-react";
import type { LandModelId, LandObject, Person } from "@/lib/types";
import { characterCellForPerson, footprintCells, isLandObjectPlacementValid, LAND_MODEL_OPTIONS, landObjectsForPerson, validateLandObjects } from "@/lib/land-objects";
import { TERRAIN_DEPTH } from "@/lib/render3d";
import { CharacterModel, GroundDetailsModel } from "./PlaneModels";
import { LandObjectInstance } from "./LandObjects3D";

const top = { grass: "#aecb82", stone: "#dfddd5", earth: "#dabb8e", sand: "#ebdcc2" };
const side = { grass: "#9a775c", stone: "#8f8985", earth: "#9a7356", sand: "#a98262" };

function firstValidPosition(objects: LandObject[], object: LandObject) {
  for (let tileY = 0; tileY < 5; tileY += 1) for (let tileX = 0; tileX < 5; tileX += 1) {
    const candidate = { ...object, tileX, tileY };
    if (isLandObjectPlacementValid(objects, candidate, object.id)) return candidate;
  }
  return null;
}

function EditorScene({ person, objects, selectedId, candidate, candidateValid, onSelect, onGridCell }: {
  person: Person; objects: LandObject[]; selectedId: string | null; candidate: LandObject | null; candidateValid: boolean;
  onSelect: (id: string) => void; onGridCell: (tileX: number, tileY: number) => void;
}) {
  const character = characterCellForPerson({ ...person, landObjects: objects });
  const hiddenId = candidate?.id;
  return <>
    <ambientLight intensity={.42}/><hemisphereLight args={["#fff8e9", "#aab99e", 1.55]}/>
    <directionalLight position={[-6, 12, 8]} intensity={2.5} castShadow shadow-mapSize={[1024,1024]}/>
    <group position={[-2.5,0,-2.5]}>
      {Array.from({ length: 25 }, (_, index) => {
        const x=index%5,z=Math.floor(index/5);
        return <group key={index}>
          <mesh position={[x+.5,0,z+.5]} rotation={[-Math.PI/2,0,0]} receiveShadow onClick={event=>{event.stopPropagation();onGridCell(x,z);}}>
            <planeGeometry args={[1,1]}/><meshStandardMaterial color={top[person.ground]} roughness={.94}/>
          </mesh>
          <Line points={[[x+.03,.025,z+.03],[x+.97,.025,z+.03],[x+.97,.025,z+.97],[x+.03,.025,z+.97],[x+.03,.025,z+.03]]} color="#f8fff1" transparent opacity={.42} lineWidth={1}/>
          {z===0&&<mesh position={[x+.5,-TERRAIN_DEPTH/2,0]}><boxGeometry args={[1,TERRAIN_DEPTH,.025]}/><meshStandardMaterial color={side[person.ground]}/></mesh>}
          {z===4&&<mesh position={[x+.5,-TERRAIN_DEPTH/2,5]}><boxGeometry args={[1,TERRAIN_DEPTH,.025]}/><meshStandardMaterial color={side[person.ground]}/></mesh>}
          {x===0&&<mesh position={[0,-TERRAIN_DEPTH/2,z+.5]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[1,TERRAIN_DEPTH,.025]}/><meshStandardMaterial color={side[person.ground]}/></mesh>}
          {x===4&&<mesh position={[5,-TERRAIN_DEPTH/2,z+.5]} rotation={[0,Math.PI/2,0]}><boxGeometry args={[1,TERRAIN_DEPTH,.025]}/><meshStandardMaterial color={side[person.ground]}/></mesh>}
        </group>;
      })}
      <GroundDetailsModel/>
      {objects.filter(object=>object.id!==hiddenId).map(object=><LandObjectInstance key={object.id} object={object} person={person}>
        <mesh position={[0,.05,0]} rotation={[-Math.PI/2,0,0]} onClick={event=>{event.stopPropagation();onSelect(object.id);}}>
          <planeGeometry args={[.82,.82]}/><meshBasicMaterial color={selectedId===object.id?"#fff6c9":"#ffffff"} transparent opacity={selectedId===object.id ? .3 : .001} depthWrite={false}/>
        </mesh>
      </LandObjectInstance>)}
      {candidate&&<group>
        {footprintCells(candidate).map(cell=><mesh key={`${cell.tileX},${cell.tileY}`} position={[cell.tileX+.5,.045,cell.tileY+.5]} rotation={[-Math.PI/2,0,0]}>
          <planeGeometry args={[.88,.88]}/><meshBasicMaterial color={candidateValid?"#66c987":"#e16d65"} transparent opacity={.38} depthWrite={false}/>
        </mesh>)}
        <LandObjectInstance object={candidate} person={person}/>
      </group>}
      <group position={[character.tileX+.5,0,character.tileY+.5]}><CharacterModel person={person}/></group>
    </group>
    <ContactShadows position={[0,-.42,0]} opacity={.25} scale={10} blur={2.5} far={3}/>
    <OrbitControls makeDefault enableRotate={false} screenSpacePanning minZoom={35} maxZoom={105} target={[0,.4,0]}/>
  </>;
}

export default function LandEditor3D({ person, onSave, onCancel }: { person: Person; onSave: (objects: LandObject[]) => Promise<void>; onCancel: () => void }) {
  const original = useMemo(()=>landObjectsForPerson(person),[person]);
  const [objects,setObjects]=useState<LandObject[]>(original);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [candidate,setCandidate]=useState<LandObject|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const candidateValid=Boolean(candidate&&isLandObjectPlacementValid(objects,candidate,candidate.id));
  const beginAdd=(modelId:LandModelId)=>{
    setError("");
    const existingHouse=modelId.startsWith("house.")?objects.find(object=>object.modelId.startsWith("house.")):undefined;
    const seed:LandObject=existingHouse?{...existingHouse,modelId}:{id:crypto.randomUUID(),modelId,tileX:0,tileY:0,rotation:0};
    const placed=firstValidPosition(objects,seed);
    if(!placed){setError("There isn’t a valid open footprint for that model.");return;}
    setCandidate(placed);setSelectedId(seed.id);
  };
  const beginMove=()=>{const selected=objects.find(object=>object.id===selectedId);if(selected)setCandidate({...selected});};
  const rotate=()=>{const source=candidate??objects.find(object=>object.id===selectedId);if(!source)return;setCandidate({...source,rotation:((source.rotation+90)%360) as LandObject["rotation"]});};
  const place=()=>{if(!candidate||!candidateValid)return;setObjects(current=>[...current.filter(item=>item.id!==candidate.id),candidate]);setSelectedId(candidate.id);setCandidate(null);setError("");};
  const remove=()=>{if(!selectedId)return;setObjects(current=>current.filter(item=>item.id!==selectedId));setCandidate(null);setSelectedId(null);};
  const save=async()=>{setBusy(true);setError("");try{await onSave(validateLandObjects(objects));}catch(cause){setError(cause instanceof Error?cause.message:"Your land could not be saved.");}finally{setBusy(false);}};
  return <div className="land-editor" role="dialog" aria-modal="true" aria-label="Edit my land">
    <header><div><p className="eyebrow">YOUR 5 × 5 LAND</p><h1>Edit my land</h1><span>Choose a model, then tap a grid cell. Pan and zoom remain available.</span></div><button aria-label="Cancel land editing" onClick={onCancel}><X/></button></header>
    <div className="land-editor-stage"><Canvas orthographic camera={{position:[8.7,8.2,9.5],zoom:68,near:.1,far:60}} shadows dpr={[1,1.5]}>
      <color attach="background" args={["#bfe8ff"]}/><EditorScene person={person} objects={objects} selectedId={selectedId} candidate={candidate} candidateValid={candidateValid} onSelect={id=>{setSelectedId(id);setCandidate(null);}} onGridCell={(tileX,tileY)=>candidate&&setCandidate({...candidate,tileX,tileY})}/>
    </Canvas></div>
    <aside className="land-editor-panel">
      <div className="land-editor-selection"><strong>{selectedId?"Selected object":"Add an object"}</strong>{selectedId&&<div><button onClick={beginMove}>Move</button><button onClick={rotate}><RotateCw size={15}/> Rotate</button><button className="danger" onClick={remove}><Trash2 size={15}/> Remove</button></div>}</div>
      {candidate&&<div className={`land-editor-placement ${candidateValid?"valid":"invalid"}`}><span>{candidateValid?"Valid placement":"Choose an open footprint"}</span><button onClick={()=>setCandidate(null)}>Undo</button><button disabled={!candidateValid} onClick={place}><Check size={15}/> Place</button></div>}
      <div className="land-model-picker">{LAND_MODEL_OPTIONS.map(option=><button key={option.id} title={option.group} onClick={()=>beginAdd(option.id)}><span>{option.label}</span><small>{option.group}</small></button>)}</div>
      {error&&<div className="form-error">{error}</div>}
      <div className="land-editor-actions"><button className="secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="primary" disabled={busy||Boolean(candidate)} onClick={save}>{busy?"Saving…":"Save land"}</button></div>
    </aside>
  </div>;
}
