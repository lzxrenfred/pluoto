"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Line, OrbitControls } from "@react-three/drei";
import { Plane, Vector3 } from "three";
import { Check, Move, RotateCcw, RotateCw, Trash2, X } from "lucide-react";
import type { LandModelId, LandObject, Person } from "@/lib/types";
import { characterCellForPerson, footprintCells, isLandObjectPlacementValid, LAND_MODEL_OPTIONS, landObjectsForPerson, signCellForPerson, signModelZ, validateLandObjects } from "@/lib/land-objects";
import { TERRAIN_DEPTH } from "@/lib/render3d";
import { CharacterModel, GroundDetailsModel } from "./PlaneModels";
import { LandObjectInstance } from "./LandObjects3D";
import { LandSignModel } from "./LandSignModel";

const top = { grass: "#aecb82", stone: "#dfddd5", earth: "#dabb8e", sand: "#ebdcc2", meadow: "#a8c894", clay: "#c99680" };
const side = { grass: "#9a775c", stone: "#8f8985", earth: "#9a7356", sand: "#a98262", meadow: "#8e795d", clay: "#9b6b5a" };
const SIGN_ID = "__sign__";
const dragPlane=new Plane(new Vector3(0,1,0),0);

function firstValidPosition(objects: LandObject[], object: LandObject, signPosition:{tileX:number;tileY:number}) {
  const used = new Set([`${signPosition.tileX},${signPosition.tileY}`, ...objects.filter(item => item.id !== object.id).flatMap(item => footprintCells(item).map(cell => `${cell.tileX},${cell.tileY}`))]);
  for (let tileY = 4; tileY >= 0; tileY -= 1) for (let tileX = 4; tileX >= 0; tileX -= 1) {
    const candidate = { ...object, tileX, tileY };
    if (footprintCells(candidate).every(cell => !used.has(`${cell.tileX},${cell.tileY}`)) && isLandObjectPlacementValid(objects, candidate, object.id, signPosition)) return candidate;
  }
  return null;
}

function EditorScene({ person, objects, signPosition, selectedId, candidate, candidateSign, candidateValid, dragging, onSelect, onGridCell, onObjectDown, onSignDown, onDragMove, onDragEnd }: {
  person: Person; objects: LandObject[]; signPosition:{tileX:number;tileY:number}; selectedId: string | null; candidate: LandObject | null; candidateSign:{tileX:number;tileY:number}|null; candidateValid: boolean;
  dragging:boolean;
  onSelect: (id: string) => void; onGridCell: (tileX: number, tileY: number) => void;
  onObjectDown:(event:ThreeEvent<PointerEvent>,id:string)=>void;onSignDown:(event:ThreeEvent<PointerEvent>)=>void;
  onDragMove:(event:ThreeEvent<PointerEvent>)=>void;onDragEnd:(event:ThreeEvent<PointerEvent>)=>void;
}) {
  const character = characterCellForPerson({ ...person, landObjects: objects, signPosition:candidateSign??signPosition });
  return <>
    <ambientLight intensity={.42}/><hemisphereLight args={["#fff8e9", "#aab99e", 1.55]}/>
    <directionalLight position={[-6, 12, 8]} intensity={2.5} castShadow shadow-mapSize={[1024,1024]}/>
    <group position={[-2.5,0,-2.5]} onPointerMove={onDragMove} onPointerUp={onDragEnd}>
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
      {objects.map(object=><group key={object.id} onPointerDown={event=>onObjectDown(event,object.id)}>
        {object.id!==candidate?.id&&<LandObjectInstance object={object} person={person}/>}
        <mesh position={[object.tileX+(object.modelId.startsWith("house.")?1:.5),.08,object.tileY+(object.modelId.startsWith("house.")?1:.5)]} rotation={[-Math.PI/2,0,0]}>
          <planeGeometry args={[object.modelId.startsWith("house.")?1.9:.86,object.modelId.startsWith("house.")?1.9:.86]}/><meshBasicMaterial color={selectedId===object.id?"#fff6c9":"#ffffff"} transparent opacity={selectedId===object.id ? .48 : .001} depthWrite={false}/>
        </mesh>
      </group>)}
      {candidate&&<group>
        {footprintCells(candidate).map(cell=><group key={`${cell.tileX},${cell.tileY}`}>
          <mesh position={[cell.tileX+.5,.015,cell.tileY+.5]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.88,.88]}/><meshBasicMaterial color={candidateValid?"#66c987":"#e16d65"} transparent opacity={.27} depthWrite={false}/></mesh>
          <Line points={[[cell.tileX+.07,.11,cell.tileY+.07],[cell.tileX+.93,.11,cell.tileY+.07],[cell.tileX+.93,.11,cell.tileY+.93],[cell.tileX+.07,.11,cell.tileY+.93],[cell.tileX+.07,.11,cell.tileY+.07]]} color={candidateValid?"#27754d":"#b9413b"} lineWidth={2}/>
        </group>)}
        <group onPointerDown={event=>onObjectDown(event,candidate.id)}><LandObjectInstance object={candidate} person={person} ghost/></group>
      </group>}
      <group position={[(candidateSign??signPosition).tileX+.5,0,signModelZ(candidateSign??signPosition)]} rotation={[0,Math.PI/4,0]} onPointerDown={onSignDown}>
        <mesh position={[0,.02,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.45,24]}/><meshBasicMaterial color={selectedId===SIGN_ID?"#fff1a8":"#ffffff"} transparent opacity={selectedId===SIGN_ID?.68:.001}/></mesh>
        <LandSignModel nickname={person.nickname}/>
      </group>
      <group position={[character.tileX+.5,0,character.tileY+.5]}><CharacterModel person={person}/></group>
    </group>
    <ContactShadows position={[0,-.42,0]} opacity={.25} scale={10} blur={2.5} far={3}/>
    <OrbitControls makeDefault enabled={!dragging} enableRotate={false} screenSpacePanning minZoom={35} maxZoom={105} target={[0,.4,0]}/>
  </>;
}

export default function LandEditor3D({ person, onSave, onCancel }: { person: Person; onSave: (objects: LandObject[], signPosition:{tileX:number;tileY:number}) => Promise<void>; onCancel: () => void }) {
  const original = useMemo(()=>landObjectsForPerson(person),[person]);
  const [objects,setObjects]=useState<LandObject[]>(original);
  const [signPosition,setSignPosition]=useState(signCellForPerson(person));
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [candidate,setCandidate]=useState<LandObject|null>(null);
  const [candidateSign,setCandidateSign]=useState<{tileX:number;tileY:number}|null>(null);
  const [dragging,setDragging]=useState(false);
  const drag=useRef<{pointerId:number;startX:number;startY:number;moved:boolean;kind:"object"|"sign"}|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const candidateValid=candidateSign?(()=>{try{validateLandObjects(objects,candidateSign);return true;}catch{return false;}})():Boolean(candidate&&isLandObjectPlacementValid(objects,candidate,candidate.id,signPosition));
  const beginAdd=(modelId:LandModelId)=>{
    setError("");
    const existingHouse=modelId.startsWith("house.")?objects.find(object=>object.modelId.startsWith("house.")):undefined;
    const seed:LandObject=existingHouse?{...existingHouse,modelId}:{id:crypto.randomUUID(),modelId,tileX:0,tileY:0,rotation:0};
    const placed=existingHouse?seed:firstValidPosition(objects,seed,signPosition);
    if(!placed){setError("There isn’t a valid open footprint for that model.");return;}
    setCandidate(placed);setCandidateSign(null);setSelectedId(seed.id);
  };
  const beginMove=()=>{if(selectedId===SIGN_ID){setCandidateSign(signPosition);return;}const selected=objects.find(object=>object.id===selectedId);if(selected)setCandidate({...selected});};
  const rotate=()=>{const source=candidate??objects.find(object=>object.id===selectedId);if(!source)return;setCandidate({...source,rotation:((source.rotation+90)%360) as LandObject["rotation"]});};
  const place=()=>{if(!candidateValid)return;if(candidateSign){setSignPosition(candidateSign);setCandidateSign(null);}else if(candidate){setObjects(current=>[...current.filter(item=>item.id!==candidate.id),candidate]);setCandidate(null);}setSelectedId(null);setError("");};
  const remove=()=>{if(!selectedId||selectedId===SIGN_ID)return;setObjects(current=>current.filter(item=>item.id!==selectedId));setCandidate(null);setSelectedId(null);};
  const resetLand=()=>{if(!window.confirm("Clear every object from your land? Your name banner will remain."))return;setObjects([]);setCandidate(null);setCandidateSign(null);setSelectedId(null);setError("");};
  const save=async()=>{setBusy(true);setError("");try{await onSave(validateLandObjects(objects,signPosition),signPosition);}catch(cause){setError(cause instanceof Error?cause.message:"Your land could not be saved.");}finally{setBusy(false);}};
  const startDrag=(event:ThreeEvent<PointerEvent>,kind:"object"|"sign",id?:string)=>{event.stopPropagation();(event.nativeEvent.target as Element).setPointerCapture?.(event.pointerId);drag.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,kind};setDragging(true);if(kind==="sign"){setSelectedId(SIGN_ID);setCandidateSign(signPosition);setCandidate(null);}else if(id){setSelectedId(id);setCandidate(objects.find(item=>item.id===id)??candidate);setCandidateSign(null);}};
  const moveDrag=(event:ThreeEvent<PointerEvent>)=>{const active=drag.current;if(!active||active.pointerId!==event.pointerId)return;if(Math.hypot(event.clientX-active.startX,event.clientY-active.startY)<4&&!active.moved)return;const point=event.ray.intersectPlane(dragPlane,new Vector3());if(!point)return;active.moved=true;const tileX=Math.floor(point.x+2.5),tileY=Math.floor(point.z+2.5);if(active.kind==="sign")setCandidateSign({tileX,tileY});else setCandidate(current=>current?{...current,tileX,tileY}:current);};
  const endDrag=(event:ThreeEvent<PointerEvent>)=>{const active=drag.current;if(!active||active.pointerId!==event.pointerId)return;(event.nativeEvent.target as Element).releasePointerCapture?.(event.pointerId);drag.current=null;setDragging(false);if(!active.moved){setCandidate(null);setCandidateSign(null);return;}const point=event.ray.intersectPlane(dragPlane,new Vector3());if(!point)return;const tileX=Math.floor(point.x+2.5),tileY=Math.floor(point.z+2.5);if(active.kind==="sign"){const position={tileX,tileY};try{validateLandObjects(objects,position);setSignPosition(position);setCandidateSign(null);setError("");}catch{setCandidateSign(position);setError("Choose an open cell for the banner.");}}else{const source=candidate??objects.find(item=>item.id===selectedId);if(!source)return;const placed={...source,tileX,tileY};if(isLandObjectPlacementValid(objects,placed,placed.id,signPosition)){setObjects(current=>[...current.filter(item=>item.id!==placed.id),placed]);setCandidate(null);setError("");}else{setCandidate(placed);setError("Choose an open footprint.");}}};
  return <div className="land-editor" role="dialog" aria-modal="true" aria-label="Edit my land">
    <header><div><p className="eyebrow">YOUR 5 × 5 LAND</p><h1>Edit my land</h1><span>Choose or drag a model to place it.</span></div><button aria-label="Cancel land editing" onClick={onCancel}><X/></button></header>
    <div className="land-editor-stage"><Canvas orthographic camera={{position:[8.7,8.2,9.5],zoom:68,near:.1,far:60}} shadows dpr={[1,1.5]}>
      <color attach="background" args={["#bfe8ff"]}/><EditorScene person={person} objects={objects} signPosition={signPosition} selectedId={selectedId} candidate={candidate} candidateSign={candidateSign} candidateValid={candidateValid} dragging={dragging} onSelect={id=>{setSelectedId(id);setCandidate(null);}} onGridCell={(tileX,tileY)=>{if(candidate)setCandidate({...candidate,tileX,tileY});if(candidateSign)setCandidateSign({tileX,tileY});}} onObjectDown={(event,id)=>startDrag(event,"object",id)} onSignDown={event=>startDrag(event,"sign")} onDragMove={moveDrag} onDragEnd={endDrag}/>
    </Canvas></div>
    <aside className="land-editor-panel">
      <div className="land-editor-selection"><div className="land-editor-selection-heading"><strong>{selectedId===SIGN_ID?"Name banner · required":selectedId?`Selected: ${LAND_MODEL_OPTIONS.find(option=>objects.find(item=>item.id===selectedId)?.modelId===option.id)?.label??"object"}`:"Select or add an object"}</strong><button className="land-reset" disabled={busy} onClick={resetLand} title="Reset land"><RotateCcw size={15}/> Reset land</button></div>{selectedId&&<div className="land-editor-selection-tools"><button onClick={beginMove}><Move size={15}/> Move</button>{selectedId!==SIGN_ID&&<><button onClick={rotate}><RotateCw size={15}/> Rotate</button><button className="danger" onClick={remove}><Trash2 size={15}/> Remove</button></>}</div>}</div>
      {(candidate||candidateSign)&&<div className={`land-editor-placement ${candidateValid?"valid":"invalid"}`}><span>{candidateValid?"Ready to place":"Choose an open footprint"}</span><button onClick={()=>{setCandidate(null);setCandidateSign(null);}}>Undo</button><button disabled={!candidateValid} onClick={place}><Check size={15}/> Place</button></div>}
      <div className="land-model-picker"><button className={selectedId===SIGN_ID?"selected":""} onClick={()=>{setSelectedId(SIGN_ID);setCandidateSign(signPosition);setCandidate(null);}}><span>Name banner</span><small>Required · 1</small></button>{LAND_MODEL_OPTIONS.map(option=><button key={option.id} className={candidate?.modelId===option.id||(!candidate&&objects.find(item=>item.id===selectedId)?.modelId===option.id)?"selected":""} title={option.group} onClick={()=>beginAdd(option.id)}><span>{option.label}</span><small>{option.group}{option.group==="Homes"?" · 1 only":""}</small></button>)}</div>
      {error&&<div className="form-error">{error}</div>}
      <div className="land-editor-actions"><button className="secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="primary" disabled={busy||Boolean(candidate)||Boolean(candidateSign)} onClick={save}>{busy?"Saving…":"Save land"}</button></div>
    </aside>
  </div>;
}
