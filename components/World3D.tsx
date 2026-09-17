"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import { Plane, Vector3, OrthographicCamera, MeshStandardMaterial, PlaneGeometry, BoxGeometry } from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { Person } from '@/lib/types';
import { spaceTiles, isSlotFree } from '@/lib/world';
import { CAMERA_OFFSET, TERRAIN_DEPTH, spaceAnchor, dragToSpace } from '@/lib/render3d';
import { houseCells, characterCells, placements, type Placement } from './Plot';
import { Character } from './Character';
import { BenchModel, CharacterModel, FlowerPatchModel, GroundDetailsModel, HouseModel, MailboxModel, PathModel, ShrubModel, TreeModel } from './PlaneModels';

type Props = {people:Person[]; arrangeMode:boolean; motionPaused?:boolean; onPeopleChange:(people:Person[])=>void; onCharacterClick:(person:Person)=>void};
type Command = {id:number; kind:'reset'|'zoom'|'focus'; amount?:number; person?:Person};
const floor = new Plane(new Vector3(0,1,0),0);
const palette = {grass:'#aecb82',stone:'#dfddd5',earth:'#dabb8e',sand:'#ebdcc2'};

function EnvironmentModel({placement,index}:{placement:Placement;index:number}) {
  if(placement.kind==='tree') return <TreeModel variant={placement.variant}/>;
  if(placement.kind==='bush') return <ShrubModel/>;
  if(placement.kind==='flowers') return <FlowerPatchModel/>;
  if(placement.kind==='path') return <PathModel variant={index}/>;
  if(placement.kind==='bench') return <BenchModel/>;
  if(placement.kind==='mailbox') return <MailboxModel/>;
  return null;
}

function CameraRig({command, arranging}:{command:Command; arranging:boolean}) {
  const {camera,size,invalidate} = useThree();
  const ref = useRef<Controls>(null);
  useEffect(() => {
    const cam = camera as OrthographicCamera;
    const controls = ref.current;
    if (!controls) return;
    if(command.kind === 'zoom') cam.zoom = Math.max(18,Math.min(110,cam.zoom*(command.amount ?? 1)));
    else {
      const target = command.person ? spaceAnchor(command.person,{tileX:2,tileY:2}) : [5,0,5];
      controls.target.set(target[0],target[1],target[2]);
      cam.position.set(target[0]+CAMERA_OFFSET[0],target[1]+CAMERA_OFFSET[1],target[2]+CAMERA_OFFSET[2]);
      cam.zoom = command.kind === 'focus' ? Math.min(size.width/8,size.height/7) : Math.min(size.width/17,size.height/12);
      cam.lookAt(controls.target);
    }
    cam.updateProjectionMatrix(); controls.update(); invalidate();
  },[camera,command,size,invalidate]);
  return <OrbitControls ref={ref} makeDefault enableRotate={false} enableDamping={false} enabled={!arranging} screenSpacePanning minZoom={18} maxZoom={110} mouseButtons={{LEFT:2,MIDDLE:1,RIGHT:2}} touches={{ONE:2,TWO:2}}/>;
}

function Scene({people,arrangeMode,onPeopleChange,onCharacterClick,command,onFocus}:Props & {command:Command;onFocus:(p:Person)=>void}) {
  const drag = useRef<{person:Person;start:Vector3;target:Person}|null>(null);
  const [ghost,setGhost] = useState<Person|null>(null);
  const {gl} = useThree();
  const materials = useMemo(()=>Object.fromEntries(Object.entries(palette).map(([key,color])=>[key,new MeshStandardMaterial({color,roughness:.94})])) as Record<Person['ground'],MeshStandardMaterial>,[]);
  const planeGeometry = useMemo(()=>new PlaneGeometry(1,1),[]);
  const sideGeometry = useMemo(()=>new BoxGeometry(1,TERRAIN_DEPTH, .025),[]);
  useEffect(()=>()=>{Object.values(materials).forEach(m=>m.dispose());planeGeometry.dispose();sideGeometry.dispose();},[materials,planeGeometry,sideGeometry]);
  const cells = spaceTiles(people);
  const occupied = new Set(cells.map(t=>`${t.tileX},${t.tileY}`));
  const sample = people.find(p=>p.id==='ren') ?? people.find(p=>p.owner) ?? people[0];
  const valid = ghost ? isSlotFree(ghost,people,people.findIndex(p=>p.id===ghost.id)) : false;
  const move = (e:ThreeEvent<PointerEvent>) => {
    if(!drag.current) return;
    const hit=e.ray.intersectPlane(floor,new Vector3()); if(!hit)return;
    const p=drag.current;
    p.target={...p.person,...dragToSpace(p.person,hit.x-p.start.x,hit.z-p.start.z)};
    setGhost(p.target);
  };
  const finish = (e:ThreeEvent<PointerEvent>) => {
    const d=drag.current;if(!d)return;
    e.stopPropagation();
    if(isSlotFree(d.target,people,people.findIndex(p=>p.id===d.person.id))) onPeopleChange(people.map(p=>p.id===d.person.id?d.target:p));
    drag.current=null;setGhost(null);
    (e.target as unknown as {releasePointerCapture:(id:number)=>void}).releasePointerCapture(e.pointerId);
  };
  return <>
    <CameraRig command={command} arranging={arrangeMode}/>
    <ambientLight intensity={.28}/>
    <hemisphereLight args={['#fff8e9','#aab99e',1.5]}/>
    <directionalLight position={[-6,14,9]} intensity={2.7} color="#fff0d7" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={.025} shadow-bias={-.00015}/>
    <group onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>{drag.current=null;setGhost(null);}}>
      {cells.map(({tileX:x,tileY:z,space})=><group key={`${x},${z}`}>
        <mesh position={[x+.5,0,z+.5]} rotation={[-Math.PI/2,0,0]} geometry={planeGeometry} material={materials[space.ground]} receiveShadow
          onPointerDown={e=>{if(!arrangeMode||space.owner)return;e.stopPropagation();const hit=e.ray.intersectPlane(floor,new Vector3());if(!hit)return;drag.current={person:space,start:hit.clone(),target:space};setGhost(space);(e.target as unknown as {setPointerCapture:(id:number)=>void}).setPointerCapture(e.pointerId);}}/>
        {[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dz],i)=>!occupied.has(`${x+dx},${z+dz}`)&&<mesh key={i} geometry={sideGeometry} position={[x+.5+dx*.5,-TERRAIN_DEPTH/2,z+.5+dz*.5]} rotation={[0,dx?Math.PI/2:0,0]} castShadow receiveShadow><meshStandardMaterial color="#b49170" roughness={1}/></mesh>)}
      </group>)}
    </group>
    {sample && <>
      <group position={spaceAnchor(sample,{tileX:0,tileY:0},0)}><GroundDetailsModel/></group>
      <group position={spaceAnchor(sample,houseCells[sample.scene],2)}><HouseModel home={sample.home}/></group>
      {placements[sample.scene].map((placement,index)=><group key={`${placement.kind}-${placement.tileX}-${placement.tileY}-${index}`} position={spaceAnchor(sample,placement)}><EnvironmentModel placement={placement} index={index}/></group>)}
      <group position={spaceAnchor(sample,characterCells[sample.scene])} onClick={e=>{e.stopPropagation();onCharacterClick(sample);}} onPointerOver={()=>{gl.domElement.style.cursor='pointer';}} onPointerOut={()=>{gl.domElement.style.cursor='grab';}}><CharacterModel person={sample}/></group>
    </>}
    <ContactShadows position={[5,.01,5]} scale={14} opacity={.24} blur={2.2} far={3.2} resolution={512} frames={1} color="#6d6655"/>
    {people.map(person=><group key={person.id}>
      <Html position={spaceAnchor(person,{tileX:.0,tileY:4})} center zIndexRange={[30,10]}><button className="space3d-label" onClick={()=>onFocus(person)}>{person.nickname}{person.owner?' · YOU':''}</button></Html>
      {person.id!==sample?.id && <Html position={spaceAnchor(person,characterCells[person.scene])} center zIndexRange={[30,10]}><button className="space3d-character" aria-label={`Open ${person.nickname}'s card`} onClick={()=>onCharacterClick(person)}><Character species={person.species} color={person.color} accent={person.accent} accessory={person.accessory} size={36}/></button></Html>}
      {person.id===sample?.id && <Html position={spaceAnchor(person,characterCells[person.scene])} center zIndexRange={[30,10]}><button className="space3d-accessible" aria-label={`Open ${person.nickname}'s card`} onClick={()=>onCharacterClick(person)}>Open {person.nickname}'s card</button></Html>}
      {person.bubble && <Html position={spaceAnchor(person,characterCells[person.scene]).map((v,i)=>i===1?v+.95:v) as [number,number,number]} center zIndexRange={[35,15]}><div className="space3d-bubble">{person.bubble}</div></Html>}
    </group>)}
    {ghost && <mesh position={spaceAnchor(ghost,{tileX:0,tileY:0},5).map((v,i)=>i===1?.025:v) as [number,number,number]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[5,5]}/><meshBasicMaterial color={valid?'#91c8a4':'#dc8273'} transparent opacity={.5} depthWrite={false}/></mesh>}
  </>;
}

export default function World3D(props:Props) {
  const [command,setCommand]=useState<Command>({id:0,kind:'reset'});
  return <div className="world-viewport world3d">
    <div className="sky-haze"/><div className="cloud cloud-a"/><div className="cloud cloud-c"/>
    <Canvas orthographic camera={{position:[17,CAMERA_OFFSET[1],17],near:.1,far:100,zoom:50}} shadows="soft" dpr={[1,1.6]} frameloop="demand" gl={{antialias:true,alpha:true,powerPreference:'high-performance'}}>
      <Scene {...props} command={command} onFocus={person=>setCommand(c=>({id:c.id+1,kind:'focus',person}))}/>
    </Canvas>
    <div className="zoom-controls">
      <button aria-label="Zoom out" onClick={()=>setCommand(c=>({id:c.id+1,kind:'zoom',amount:.85}))}><Minus size={18}/></button>
      <button aria-label="Reset view" onClick={()=>setCommand(c=>({id:c.id+1,kind:'reset'}))}><RotateCcw size={16}/></button>
      <button aria-label="Zoom in" onClick={()=>setCommand(c=>({id:c.id+1,kind:'zoom',amount:1.15}))}><Plus size={18}/></button>
    </div>
    {props.arrangeMode&&<div className="arrange-tip">Drag a friend’s land · snaps to the shared grid</div>}
  </div>;
}
