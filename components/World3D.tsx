"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, Line, OrbitControls } from "@react-three/drei";
import { BoxGeometry, Group, MathUtils, MeshStandardMaterial, OrthographicCamera, PCFShadowMap, Plane, PlaneGeometry, Vector3 } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Person } from "@/lib/types";
import { isSlotFree, PLOT_TILES, type PlotPosition, type TilePosition } from "@/lib/world";
import { CAMERA_OFFSET, TERRAIN_DEPTH, spaceAnchor } from "@/lib/render3d";
import { randomWanderDelay, useMotionAllowed, walkableNeighbors } from "@/lib/motion";
import {
  CHARACTER_RETURN_MS,
  CharacterReturnTimers,
  isCharacterCellValid,
  moveLandInArrangement,
  pointerMoved,
  scenePointToPlacement,
  terrainOccupancyForLand,
  type CharacterPlacement,
} from "@/lib/world-interactions";
import { blockedLandCells, characterCellForPerson, landObjectsForPerson, signCellForPerson, signModelZ } from "@/lib/land-objects";
import type { LandObject } from "@/lib/types";
import { CharacterModel, GroundDetailsModel } from "./PlaneModels";
import { LandObjectInstance } from "./LandObjects3D";
import { LandSignModel } from "./LandSignModel";

type Props = {
  people: Person[];
  arrangeMode: boolean;
  motionPaused?: boolean;
  canPlay?: boolean;
  selectedId?: string;
  resetSignal?: number;
  onPeopleChange: (people: Person[]) => void;
  onCharacterClick: (person: Person) => void;
};
type Command = { id: number; kind: "reset" | "zoom" | "focus"; amount?: number; person?: Person };
type CharacterMap = Record<string, CharacterPlacement>;
type LandPreview = { person: Person; target: PlotPosition; valid: boolean };
type LandDrag = { person: Person; group: Group; pointerId: number; grabX: number; grabZ: number; target: PlotPosition };
type CharacterDrag = {
  person: Person; group: Group; pointerId: number; start: { x: number; y: number }; original: Vector3;
  parentLand: Person; dragged: boolean; candidate: CharacterPlacement | null; valid: boolean;
};

const floor = new Plane(new Vector3(0, 1, 0), 0);
const palette = { grass: "#aecb82", stone: "#dfddd5", earth: "#dabb8e", sand: "#ebdcc2", meadow: "#a8c894", clay: "#c99680" };
const sidePalette = { grass: "#9a775c", stone: "#8f8985", earth: "#9a7356", sand: "#a98262", meadow: "#8e795d", clay: "#9b6b5a" };
const localTiles = Array.from({ length: PLOT_TILES ** 2 }, (_, index) => ({ tileX: index % PLOT_TILES, tileY: Math.floor(index / PLOT_TILES) }));
const resetZoom = (size: { width: number; height: number }) => Math.min(size.width / 17, size.height / 12);

function CameraRig({ command, interactionActive }: { command: Command; interactionActive: boolean }) {
  const { camera, size, invalidate } = useThree();
  const ref = useRef<Controls>(null);
  const appliedCommand = useRef(-1);
  useEffect(() => {
    if (appliedCommand.current === command.id) return;
    const cam = camera as OrthographicCamera;
    const controls = ref.current;
    if (!controls) return;
    appliedCommand.current = command.id;
    if (command.kind === "zoom") cam.zoom = Math.max(18, Math.min(110, cam.zoom * (command.amount ?? 1)));
    else {
      const target = command.person ? spaceAnchor(command.person, { tileX: 2, tileY: 2 }) : [5, 0, 5];
      controls.target.set(target[0], target[1], target[2]);
      cam.position.set(target[0] + CAMERA_OFFSET[0], target[1] + CAMERA_OFFSET[1], target[2] + CAMERA_OFFSET[2]);
      cam.zoom = command.kind === "focus" ? Math.min(size.width / 8, size.height / 7) : resetZoom(size);
      cam.lookAt(controls.target);
    }
    cam.updateProjectionMatrix();
    controls.update();
    invalidate();
  }, [camera, command, size, invalidate]);
  return <OrbitControls
    ref={ref} makeDefault enableRotate={false} enableDamping={false} enabled={!interactionActive}
    screenSpacePanning minZoom={18} maxZoom={110}
    mouseButtons={{ LEFT: 2, MIDDLE: 1, RIGHT: 2 }} touches={{ ONE: 1, TWO: 2 }}
  />;
}

function AmbientObject({ object, person, index, active }: { object: LandObject; person: Person; index: number; active: boolean }) {
  const ref = useRef<Group>(null);
  const { invalidate } = useThree();
  const offset = useMemo(() => index * 1.73 + object.tileX * .71 + object.tileY * 1.13, [index, object]);
  useFrame(({ clock }) => {
    if (!ref.current || !active || !(object.modelId.startsWith("tree.") || ["bush", "flowers"].includes(object.modelId))) return;
    ref.current.rotation.z = Math.sin(clock.elapsedTime * .34 + offset) * (object.modelId.startsWith("tree.") ? .012 : .007);
    invalidate();
  });
  return <group ref={ref}><LandObjectInstance object={object} person={person}/></group>;
}

function CharacterPuff({ active }: { active: boolean }) {
  const ref = useRef<Group>(null);
  const began = useRef(0);
  const { invalidate } = useThree();
  useEffect(() => { if (active) began.current = performance.now(); }, [active]);
  useFrame(() => {
    if (!active || !ref.current) return;
    const progress = Math.min(1, (performance.now() - began.current) / 620);
    ref.current.scale.setScalar(.55 + progress * .9);
    ref.current.position.y = .1 + progress * .18;
    invalidate();
  });
  if (!active) return null;
  return <group ref={ref} position={[0, .12, 0]}>
    {[[-.26, 0, 0], [.24, .02, .04], [0, .12, -.08], [.05, -.02, .2]].map((position, index) => (
      <mesh key={index} position={position as [number, number, number]}>
        <sphereGeometry args={[.18 - index * .015, 10, 8]}/><meshBasicMaterial color="#fffdf6" transparent opacity={.7}/>
      </mesh>
    ))}
  </group>;
}

function CharacterActor({ person, placement, blocked, otherOccupants, motionActive, dragging, returning, landingPulse, showName, onPointerDown, onClick }: {
  person: Person; placement: CharacterPlacement; blocked: TilePosition[]; otherOccupants: TilePosition[];
  motionActive: boolean; dragging: boolean; returning: boolean; landingPulse: number; showName: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>, person: Person, group: Group) => void;
  onClick: () => void;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const bubble = useRef<HTMLButtonElement>(null);
  const bubbleScale = useRef(0);
  const { invalidate } = useThree();
  const seed = useMemo(() => [...person.id].reduce((total, char) => total + char.charCodeAt(0), 0), [person.id]);
  const initialWanderDelay = useMemo(() => randomWanderDelay(true), [person.id]);
  const motion = useRef({
    x: placement.tileX + .5, z: placement.tileY + .5,
    fromX: placement.tileX + .5, fromZ: placement.tileY + .5,
    toX: placement.tileX + .5, toZ: placement.tileY + .5,
    began: 0, moving: false, nextAt: initialWanderDelay, heading: .28,
  });
  const lastLanding = useRef(landingPulse);
  const landingAt = useRef(-10);
  const [bubbleExpanded, setBubbleExpanded] = useState(false);
  const placementKey = `${placement.landId}:${placement.tileX},${placement.tileY}`;

  useLayoutEffect(() => {
    const x = placement.tileX + .5;
    const z = placement.tileY + .5;
    motion.current = { ...motion.current, x, z, fromX: x, fromZ: z, toX: x, toZ: z, moving: false, heading: .28 };
    root.current?.position.set(x, 0, z);
    if (body.current) body.current.rotation.y = .28;
  }, [placementKey]);
  useFrame(({ clock, camera, size }) => {
    if (bubble.current) {
      const scale = Math.min(1, (camera as OrthographicCamera).zoom / resetZoom(size));
      if (Math.abs(scale - bubbleScale.current) > .001) {
        bubble.current.style.transform = `scale(${scale})`;
        bubbleScale.current = scale;
      }
    }
    const group = root.current;
    const character = body.current;
    if (!group || !character || dragging) return;
    const now = clock.elapsedTime;
    if (landingPulse !== lastLanding.current) { lastLanding.current = landingPulse; landingAt.current = now; }
    const state = motion.current;
    if (motionActive && !placement.temporary) {
      if (!state.moving && now >= state.nextAt) {
        const rounded = { tileX: Math.round(state.x - .5), tileY: Math.round(state.z - .5) };
        const choices = walkableNeighbors(rounded, [...blocked, ...otherOccupants]);
        if (choices.length) {
          const target = choices[Math.floor(Math.random() * choices.length)];
          state.fromX = state.x; state.fromZ = state.z; state.toX = target.tileX + .5; state.toZ = target.tileY + .5;
          state.began = now; state.moving = true; state.heading = Math.atan2(state.toX - state.fromX, state.toZ - state.fromZ);
        } else state.nextAt = now + randomWanderDelay();
      }
      if (state.moving) {
        const progress = Math.min(1, (now - state.began) / 1.35);
        const eased = progress * progress * (3 - 2 * progress);
        state.x = MathUtils.lerp(state.fromX, state.toX, eased);
        state.z = MathUtils.lerp(state.fromZ, state.toZ, eased);
        group.position.set(state.x, 0, state.z);
        character.position.y = Math.sin(progress * Math.PI * 2) ** 2 * .055;
        if (progress >= 1) { state.moving = false; state.nextAt = now + randomWanderDelay(); }
      }
      const look = !state.moving && Math.sin(now * .21 + seed) > .83 ? Math.sin(now * .7 + seed) * .18 : 0;
      character.rotation.y = MathUtils.lerp(character.rotation.y, state.heading + look, .025);
      invalidate();
    } else character.position.y = 0;
    const landingT = now - landingAt.current;
    const landing = landingT >= 0 && landingT < .42 ? Math.sin((landingT / .42) * Math.PI) * .065 : 0;
    const breathing = motionActive ? 1 + Math.sin(now * .82 + seed) * .012 : 1;
    character.scale.set(breathing + landing, breathing - landing * .25, breathing + landing);
    if (motionActive || landingT < .42) invalidate();
  });

  return <group ref={root} name={`character-${person.id}`} position={[placement.tileX + .5, 0, placement.tileY + .5]}
    onPointerDown={(event) => root.current && onPointerDown(event, person, root.current)}>
    <mesh position={[0, .015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[.3, 28]}/><meshBasicMaterial color="#455648" transparent opacity={dragging ? .1 : .18}/>
    </mesh>
    <group ref={body}><CharacterModel person={person}/></group>
    {person.bubble&&<Html position={[0,person.species==='rabbit'?1.27:person.species==='turtle'?.92:1.13,0]} zIndexRange={[35,15]} transform={false}><div className="space3d-bubble-anchor"><button ref={bubble} className={`space3d-bubble ${bubbleExpanded?"expanded":""}`} aria-expanded={bubbleExpanded} onPointerDown={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();setBubbleExpanded(value=>!value);}}>{person.bubble}</button></div></Html>}
    {showName && <Html position={[0, -.17, 0]} center zIndexRange={[36, 16]}><div className="character-name-label">{person.nickname}</div></Html>}
    <CharacterPuff active={returning}/>
  </group>;
}

function LandSign({ person, arranging, onFocus }: { person: Person; arranging: boolean; onFocus: () => void }) {
  const interactive=!arranging&&!person.owner;
  const sign = signCellForPerson(person);
  const ownerLabel = useRef<HTMLSpanElement>(null);
  const ownerLabelScale = useRef(0);
  useFrame(({ camera, size }) => {
    if (!ownerLabel.current) return;
    const scale = Math.min(1.15 ** 6, (camera as OrthographicCamera).zoom / resetZoom(size));
    if (Math.abs(scale - ownerLabelScale.current) > .001) {
      ownerLabel.current.style.transform = `scale(${scale})`;
      ownerLabelScale.current = scale;
    }
  });
  return <group position={[sign.tileX+.5,0,signModelZ(sign)]} rotation={[0,Math.PI/4,0]}
    onPointerDown={interactive?event=>event.stopPropagation():undefined}
    onClick={interactive?event=>{event.stopPropagation();onFocus();}:undefined}>
    <LandSignModel nickname={person.nickname}/>
    {person.owner&&<Html position={[0,.94,.12]} center transform={false} zIndexRange={[8,5]}><span ref={ownerLabel} className="owner-land-label">You</span></Html>}
    <Html position={[0,.53,.11]} center zIndexRange={[4,1]}>
      {person.owner?<span className="space3d-accessible" aria-label={`${person.nickname}'s home`}/>:<button className="space3d-accessible" tabIndex={arranging?-1:0} onClick={onFocus} aria-label={`Focus ${person.nickname}'s land`}/>}
    </Html>
  </group>;
}

function ArrangementGrid({ people }: { people: Person[] }) {
  const blocks = useMemo(() => {
    const xs = people.map((person) => person.plotX);
    const ys = people.map((person) => person.plotY);
    const minX = Math.min(...xs, 0) - 2, maxX = Math.max(...xs, 0) + 2;
    const minY = Math.min(...ys, 0) - 2, maxY = Math.max(...ys, 0) + 2;
    return Array.from({ length: (maxX - minX + 1) * (maxY - minY + 1) }, (_, index) => ({
      x: minX + index % (maxX - minX + 1), y: minY + Math.floor(index / (maxX - minX + 1)),
    }));
  }, [people]);
  return <group>{blocks.map((block) => {
    const x = block.x * PLOT_TILES, z = block.y * PLOT_TILES;
    return <group key={`${block.x},${block.y}`}>
      <mesh position={[x + 2.5, -.035, z + 2.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.82, 4.82]}/><meshBasicMaterial color="#f8fdff" transparent opacity={.055} depthWrite={false}/>
      </mesh>
      <Line points={[[x, .01, z], [x + 5, .01, z], [x + 5, .01, z + 5], [x, .01, z + 5], [x, .01, z]]} color="#eefbff" transparent opacity={.48} lineWidth={1}/>
    </group>;
  })}</group>;
}

function LandGhost({ preview }: { preview: LandPreview }) {
  const x = preview.target.plotX * PLOT_TILES, z = preview.target.plotY * PLOT_TILES;
  const color = preview.valid ? "#73d6a4" : "#eb766a";
  return <group>
    <mesh position={[x + 2.5, .055, z + 2.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[4.9, 4.9]}/><meshBasicMaterial color={color} transparent opacity={.26} depthWrite={false}/>
    </mesh>
    <Line points={[[x, .08, z], [x + 5, .08, z], [x + 5, .08, z + 5], [x, .08, z + 5], [x, .08, z]]}
      color={preview.valid ? "#ffffff" : "#a93638"} dashed dashSize={.28} gapSize={.18} lineWidth={2}/>
  </group>;
}

function DropIndicator({ placement, people, valid }: { placement: CharacterPlacement; people: Person[]; valid: boolean }) {
  const land = people.find((person) => person.id === placement.landId);
  if (!land) return null;
  const x = land.plotX * PLOT_TILES + placement.tileX + .5, z = land.plotY * PLOT_TILES + placement.tileY + .5;
  return <group position={[x, .075, z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.39, 32]}/>
      <meshBasicMaterial color={valid ? "#75c884" : "#dc7167"} transparent opacity={.35} depthWrite={false}/>
    </mesh>
    <Line points={Array.from({ length: 25 }, (_, index) => {
      const angle = index / 24 * Math.PI * 2;
      return [Math.cos(angle) * .43, .012, Math.sin(angle) * .43] as [number, number, number];
    })} color="#fffdf7" dashed dashSize={.1} gapSize={.07} lineWidth={2}/>
  </group>;
}

function LandChunk({ person, occupied, material, sideMaterial, planeGeometry, sideGeometry, arranging, suspendPosition,
  motionActive, characters, blockedByLand, allPlacements, activeCharacterId, labelId, returning, landingPulses,
  onLandPointerDown, onCharacterPointerDown, onCharacterClick, registerLand, onFocus }: {
  person: Person; occupied: ReadonlySet<string>; material: MeshStandardMaterial; sideMaterial: MeshStandardMaterial;
  planeGeometry: PlaneGeometry; sideGeometry: BoxGeometry; arranging: boolean; suspendPosition: boolean;
  motionActive: boolean; characters: Person[]; blockedByLand: ReadonlyMap<string, ReadonlySet<string>>;
  allPlacements: ReadonlyMap<string, CharacterPlacement>; activeCharacterId: string | null;
  labelId: string | null;
  returning: ReadonlySet<string>; landingPulses: Readonly<Record<string, number>>;
  onLandPointerDown: (event: ThreeEvent<PointerEvent>, person: Person) => void;
  onCharacterPointerDown: (event: ThreeEvent<PointerEvent>, person: Person, group: Group) => void;
  onCharacterClick: (person: Person) => void;
  registerLand: (group: Group | null) => void;
  onFocus: () => void;
}) {
  const root = useRef<Group>(null);
  useLayoutEffect(() => {
    registerLand(root.current);
    if (!suspendPosition) root.current?.position.set(person.plotX * PLOT_TILES, 0, person.plotY * PLOT_TILES);
    return () => registerLand(null);
  }, [person.plotX, person.plotY, registerLand, suspendPosition]);
  const blocked = [...(blockedByLand.get(person.id) ?? [])].map((key) => {
    const [tileX, tileY] = key.split(",").map(Number);
    return { tileX, tileY };
  });
  return <group ref={root} name={`land-${person.id}`}>
    {localTiles.map(({ tileX: x, tileY: z }) => {
      const globalX = person.plotX * PLOT_TILES + x, globalZ = person.plotY * PLOT_TILES + z;
      return <group key={`${x},${z}`}>
        <mesh position={[x + .5, 0, z + .5]} rotation={[-Math.PI / 2, 0, 0]} geometry={planeGeometry} material={material}
          receiveShadow onPointerDown={(event) => onLandPointerDown(event, person)}/>
        {[[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dz], index) => !occupied.has(`${globalX + dx},${globalZ + dz}`) && (
          <mesh key={index} geometry={sideGeometry} material={sideMaterial}
            position={[x + .5 + dx * .5, -TERRAIN_DEPTH / 2, z + .5 + dz * .5]}
            rotation={[0, dx ? Math.PI / 2 : 0, 0]} castShadow receiveShadow/>
        ))}
      </group>;
    })}
    <GroundDetailsModel/>
    {landObjectsForPerson(person).map((object, index) => <AmbientObject key={object.id} object={object} person={person} index={index} active={motionActive}/>)}
    {characters.map((character) => {
      const placement = allPlacements.get(character.id)!;
      const otherOccupants = [...allPlacements.entries()].filter(([id, item]) => id !== character.id && item.landId === person.id)
        .map(([, item]) => ({ tileX: item.tileX, tileY: item.tileY }));
      return <CharacterActor key={character.id} person={character} placement={placement} blocked={blocked}
        otherOccupants={otherOccupants} motionActive={motionActive} dragging={activeCharacterId === character.id}
        returning={returning.has(character.id)} landingPulse={landingPulses[character.id] ?? 0}
        showName={labelId === character.id} onPointerDown={onCharacterPointerDown} onClick={()=>onCharacterClick(character)}/>;
    })}
    <LandSign person={person} arranging={arranging} onFocus={onFocus}/>
  </group>;
}

function Scene({ people, arrangeMode, motionPaused = false, canPlay = true, selectedId, onPeopleChange, onCharacterClick,
  command, temporary, returning, onTemporaryDrop, onFocus }: Props & {
  command: Command; temporary: CharacterMap; returning: ReadonlySet<string>;
  onTemporaryDrop: (id: string, placement: CharacterPlacement) => void; onFocus: (person: Person) => void;
}) {
  const { gl, invalidate } = useThree();
  const motionAllowed = useMotionAllowed();
  const landGroups = useRef(new Map<string, Group>());
  const landDrag = useRef<LandDrag | null>(null);
  const characterDrag = useRef<CharacterDrag | null>(null);
  const pointers = useRef(new Set<number>());
  const settleAnimations = useRef(new Map<string, { group: Group; from: Vector3; to: Vector3; began: number; duration: number }>());
  const [interactionActive, setInteractionActive] = useState(false);
  const [visualLandId, setVisualLandId] = useState<string | null>(null);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [landPreview, setLandPreview] = useState<LandPreview | null>(null);
  const [dropPreview, setDropPreview] = useState<{ placement: CharacterPlacement; valid: boolean } | null>(null);
  const [labelId, setLabelId] = useState<string | null>(null);
  const [landingPulses, setLandingPulses] = useState<Record<string, number>>({});
  const labelTimer = useRef<number | null>(null);

  const materials = useMemo(() => Object.fromEntries(Object.entries(palette).map(([key, color]) => [key, new MeshStandardMaterial({ color, roughness: .94 })])) as Record<Person["ground"], MeshStandardMaterial>, []);
  const sideMaterials = useMemo(() => Object.fromEntries(Object.entries(sidePalette).map(([key, color]) => [key, new MeshStandardMaterial({ color, roughness: 1 })])) as Record<Person["ground"], MeshStandardMaterial>, []);
  const planeGeometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const sideGeometry = useMemo(() => new BoxGeometry(1, TERRAIN_DEPTH, .025), []);
  useEffect(() => () => {
    Object.values(materials).forEach((material) => material.dispose());
    Object.values(sideMaterials).forEach((material) => material.dispose());
    planeGeometry.dispose(); sideGeometry.dispose();
  }, [materials, sideMaterials, planeGeometry, sideGeometry]);

  const occupiedByLand = useMemo(() => new Map(people.map(person=>[person.id,terrainOccupancyForLand(people,person.id,visualLandId)])), [people,visualLandId]);
  const blockedByLand = useMemo(() => new Map(people.map((person) => [person.id, blockedLandCells(person)])), [people]);
  const effectivePlacements = useMemo(() => new Map(people.map((person) => [person.id,
    temporary[person.id] ?? { landId: person.id, ...characterCellForPerson(person) },
  ])), [people, temporary]);
  const peopleByLand = useMemo(() => new Map(people.map((land) => [land.id,
    people.filter((person) => effectivePlacements.get(person.id)?.landId === land.id),
  ])), [people, effectivePlacements]);

  const showLabel = useCallback((id: string) => {
    setLabelId(id);
    if (labelTimer.current !== null) window.clearTimeout(labelTimer.current);
    labelTimer.current = window.setTimeout(() => setLabelId((current) => current === id ? null : current), 1600);
  }, []);
  useEffect(() => { if (selectedId) showLabel(selectedId); }, [selectedId, showLabel]);
  useEffect(() => () => { if (labelTimer.current !== null) window.clearTimeout(labelTimer.current); }, []);

  const releaseCapture = (event: ThreeEvent<PointerEvent>) => {
    const target = event.nativeEvent.target as Element;
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
  };
  const capture = (event: ThreeEvent<PointerEvent>) => (event.nativeEvent.target as Element).setPointerCapture?.(event.pointerId);
  const animateLand = useCallback((id: string, group: Group, to: Vector3, duration = 280) => {
    settleAnimations.current.set(id, { group, from: group.position.clone(), to, began: performance.now(), duration });
    setVisualLandId(id); invalidate();
  }, [invalidate]);
  const cancelLandDrag = useCallback(() => {
    const drag = landDrag.current;
    if (!drag) return;
    if (gl.domElement.hasPointerCapture?.(drag.pointerId)) gl.domElement.releasePointerCapture(drag.pointerId);
    animateLand(drag.person.id, drag.group, new Vector3(drag.person.plotX * PLOT_TILES, 0, drag.person.plotY * PLOT_TILES));
    landDrag.current = null; setLandPreview(null); setInteractionActive(false);
  }, [animateLand, gl]);
  const cancelCharacterDrag = useCallback(() => {
    const drag = characterDrag.current;
    if (!drag) return;
    if (gl.domElement.hasPointerCapture?.(drag.pointerId)) gl.domElement.releasePointerCapture(drag.pointerId);
    drag.group.position.copy(drag.original); characterDrag.current = null; setActiveCharacterId(null);
    setDropPreview(null); setInteractionActive(false); invalidate();
  }, [gl, invalidate]);

  useEffect(() => {
    const element = gl.domElement;
    const down = (event: PointerEvent) => {
      pointers.current.add(event.pointerId);
      if (event.pointerType === "touch" && pointers.current.size > 1) { cancelLandDrag(); cancelCharacterDrag(); }
    };
    const up = (event: PointerEvent) => pointers.current.delete(event.pointerId);
    element.addEventListener("pointerdown", down, true); element.addEventListener("pointerup", up, true); element.addEventListener("pointercancel", up, true);
    return () => {
      element.removeEventListener("pointerdown", down, true); element.removeEventListener("pointerup", up, true); element.removeEventListener("pointercancel", up, true);
    };
  }, [gl, cancelLandDrag, cancelCharacterDrag]);

  useFrame(() => {
    if (!settleAnimations.current.size) return;
    const now = performance.now();
    settleAnimations.current.forEach((animation, id) => {
      const progress = Math.min(1, (now - animation.began) / animation.duration);
      const eased = 1 - (1 - progress) ** 3;
      animation.group.position.lerpVectors(animation.from, animation.to, eased);
      animation.group.position.y += Math.sin(progress * Math.PI) * .09;
      if (progress >= 1) {
        animation.group.position.copy(animation.to); settleAnimations.current.delete(id);
        setVisualLandId((current) => current === id ? null : current);
      }
    });
    invalidate();
  });

  const onLandPointerDown = (event: ThreeEvent<PointerEvent>, person: Person) => {
    if (!arrangeMode || person.owner || visualLandId || (event.pointerType === "touch" && pointers.current.size > 1)) return;
    const group = landGroups.current.get(person.id), hit = event.ray.intersectPlane(floor, new Vector3());
    if (!group || !hit) return;
    event.stopPropagation(); capture(event);
    const originX = person.plotX * PLOT_TILES, originZ = person.plotY * PLOT_TILES;
    landDrag.current = { person, group, pointerId: event.pointerId, grabX: hit.x - originX, grabZ: hit.z - originZ, target: person };
    setVisualLandId(person.id); setInteractionActive(true); setLandPreview({ person, target: person, valid: true });
  };
  const onCharacterPointerDown = (event: ThreeEvent<PointerEvent>, person: Person, group: Group) => {
    if ((event.nativeEvent.target as Element | null)?.closest?.(".space3d-bubble")) return;
    if (arrangeMode || !canPlay || (event.pointerType === "touch" && pointers.current.size > 1)) return;
    const placement = effectivePlacements.get(person.id)!;
    const parentLand = people.find((land) => land.id === placement.landId);
    if (!parentLand) return;
    event.stopPropagation(); capture(event);
    characterDrag.current = { person, group, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY },
      original: group.position.clone(), parentLand, dragged: false, candidate: null, valid: false };
    showLabel(person.id);
  };
  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const land = landDrag.current;
    if (land && land.pointerId === event.pointerId) {
      const hit = event.ray.intersectPlane(floor, new Vector3());
      if (!hit) return;
      event.stopPropagation();
      const originX = hit.x - land.grabX, originZ = hit.z - land.grabZ;
      land.group.position.set(originX, .16, originZ);
      const target = { plotX: Math.round(originX / PLOT_TILES), plotY: Math.round(originZ / PLOT_TILES) };
      land.target = target;
      const valid = isSlotFree(target, people, people.findIndex((person) => person.id === land.person.id));
      setLandPreview((current) => current?.target.plotX === target.plotX && current.target.plotY === target.plotY && current.valid === valid ? current : { person: land.person, target, valid });
      invalidate(); return;
    }
    const character = characterDrag.current;
    if (!character || character.pointerId !== event.pointerId) return;
    if (!character.dragged && !pointerMoved(character.start, { x: event.clientX, y: event.clientY })) return;
    if (!character.dragged) { character.dragged = true; setActiveCharacterId(character.person.id); setInteractionActive(true); }
    const hit = event.ray.intersectPlane(floor, new Vector3());
    if (!hit) return;
    event.stopPropagation();
    character.group.position.set(hit.x - character.parentLand.plotX * PLOT_TILES, .5, hit.z - character.parentLand.plotY * PLOT_TILES);
    const candidate = scenePointToPlacement(people, hit.x, hit.z);
    const valid = isCharacterCellValid(candidate, blockedByLand, effectivePlacements, character.person.id);
    character.candidate = candidate; character.valid = valid;
    setDropPreview(candidate ? { placement: candidate, valid } : null); invalidate();
  };
  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    const land = landDrag.current;
    if (land && land.pointerId === event.pointerId) {
      event.stopPropagation(); releaseCapture(event);
      const valid = isSlotFree(land.target, people, people.findIndex((person) => person.id === land.person.id));
      if (valid) {
        onPeopleChange(moveLandInArrangement(people, land.person.id, land.target));
        animateLand(land.person.id, land.group, new Vector3(land.target.plotX * PLOT_TILES, 0, land.target.plotY * PLOT_TILES));
      } else animateLand(land.person.id, land.group, new Vector3(land.person.plotX * PLOT_TILES, 0, land.person.plotY * PLOT_TILES));
      landDrag.current = null; setLandPreview(null); setInteractionActive(false); return;
    }
    const character = characterDrag.current;
    if (!character || character.pointerId !== event.pointerId) return;
    event.stopPropagation(); releaseCapture(event);
    if (!character.dragged) onCharacterClick(character.person);
    else if (character.valid && character.candidate) {
      onTemporaryDrop(character.person.id, character.candidate);
      setLandingPulses((current) => ({ ...current, [character.person.id]: (current[character.person.id] ?? 0) + 1 }));
    } else character.group.position.copy(character.original);
    characterDrag.current = null; setActiveCharacterId(null); setDropPreview(null); setInteractionActive(false); invalidate();
    window.setTimeout(() => setDropPreview(null), 80);
  };

  const bounds = useMemo(() => {
    const minX = Math.min(...people.map((person) => person.plotX * PLOT_TILES));
    const maxX = Math.max(...people.map((person) => (person.plotX + 1) * PLOT_TILES));
    const minZ = Math.min(...people.map((person) => person.plotY * PLOT_TILES));
    const maxZ = Math.max(...people.map((person) => (person.plotY + 1) * PLOT_TILES));
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, scale: Math.max(14, maxX - minX + 4, maxZ - minZ + 4) };
  }, [people]);

  return <>
    <CameraRig command={command} interactionActive={interactionActive}/>
    <ambientLight intensity={.28}/><hemisphereLight args={["#fff8e9", "#aab99e", 1.5]}/>
    <directionalLight position={[-6, 14, 9]} intensity={2.7} color="#fff0d7" castShadow shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18}
      shadow-normalBias={.025} shadow-bias={-.00015}/>
    {arrangeMode && <ArrangementGrid people={people}/>}
    <group onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={(event) => { releaseCapture(event); cancelLandDrag(); cancelCharacterDrag(); }}>
      {people.map((person) => <LandChunk key={person.id} person={person} occupied={occupiedByLand.get(person.id)!}
        material={materials[person.ground]} sideMaterial={sideMaterials[person.ground]}
        planeGeometry={planeGeometry} sideGeometry={sideGeometry} arranging={arrangeMode}
        suspendPosition={visualLandId === person.id} motionActive={motionAllowed && !motionPaused && !arrangeMode}
        characters={peopleByLand.get(person.id) ?? []} blockedByLand={blockedByLand} allPlacements={effectivePlacements}
        activeCharacterId={activeCharacterId} labelId={labelId} returning={returning} landingPulses={landingPulses}
        onLandPointerDown={onLandPointerDown} onCharacterPointerDown={onCharacterPointerDown}
        onCharacterClick={onCharacterClick}
        registerLand={(group) => group ? landGroups.current.set(person.id, group) : landGroups.current.delete(person.id)}
        onFocus={() => onFocus(person)}/>)}
    </group>
    <ContactShadows position={[bounds.x, .01, bounds.z]} scale={bounds.scale} opacity={.24} blur={2.2} far={3.2} resolution={512} frames={1} color="#6d6655"/>
    {landPreview && <LandGhost preview={landPreview}/>} {dropPreview && <DropIndicator placement={dropPreview.placement} people={people} valid={dropPreview.valid}/>}
    {people.map((person) => {
      const placement = effectivePlacements.get(person.id)!;
      const land = people.find((candidate) => candidate.id === placement.landId);
      if (!land) return null;
      const position: [number, number, number] = [land.plotX * PLOT_TILES + placement.tileX + .5, 1.18, land.plotY * PLOT_TILES + placement.tileY + .5];
      return <group key={`overlay-${person.id}`}>
        <Html position={[position[0], .3, position[2]]} center zIndexRange={[2, 1]}><button className="space3d-accessible" aria-label={`Open ${person.nickname}'s card`} onClick={() => onCharacterClick(person)}>Open {person.nickname}&apos;s card</button></Html>
      </group>;
    })}
  </>;
}

export default function World3D(props: Props) {
  const eventSource = useRef<HTMLDivElement>(null);
  const [command, setCommand] = useState<Command>({ id: 0, kind: "reset" });
  const [temporary, setTemporary] = useState<CharacterMap>({});
  const [returning, setReturning] = useState<Set<string>>(new Set());
  const timers = useRef<CharacterReturnTimers | null>(null);
  const transitionTimers = useRef<number[]>([]);

  useEffect(() => {
    timers.current = new CharacterReturnTimers((id) => {
      setReturning((current) => new Set(current).add(id));
      transitionTimers.current.push(window.setTimeout(() => setTemporary((current) => {
        const next = { ...current }; delete next[id]; return next;
      }), 220));
      transitionTimers.current.push(window.setTimeout(() => setReturning((current) => {
        const next = new Set(current); next.delete(id); return next;
      }), 720));
    });
    const reconcile = () => { if (!document.hidden) timers.current?.reconcile(); };
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      document.removeEventListener("visibilitychange", reconcile); timers.current?.clear();
      transitionTimers.current.forEach(window.clearTimeout);
    };
  }, []);
  useEffect(() => {
    const ids = new Set(props.people.map((person) => person.id));
    setTemporary((current) => {
      let changed = false;
      const next: CharacterMap = {};
      Object.entries(current).forEach(([id, placement]) => {
        const land=props.people.find(person=>person.id===placement.landId);
        const valid=land&&!blockedLandCells(land).has(`${placement.tileX},${placement.tileY}`);
        if (ids.has(id) && ids.has(placement.landId) && valid) next[id] = placement;
        else { changed = true; timers.current?.cancel(id); }
      });
      return changed ? next : current;
    });
  }, [props.people]);
  useEffect(() => {
    if (props.resetSignal === undefined) return;
    setCommand((current) => ({ id: current.id + 1, kind: "reset" }));
  }, [props.resetSignal]);

  const onTemporaryDrop = useCallback((id: string, placement: CharacterPlacement) => {
    const returnAt = Date.now() + CHARACTER_RETURN_MS;
    setTemporary((current) => ({ ...current, [id]: { ...placement, temporary: true, returnAt } }));
    timers.current?.schedule(id, returnAt);
  }, []);

  return <div ref={eventSource} className={`world-viewport world3d ${props.arrangeMode ? "arranging" : ""}`}>
    <div className="sky-haze"/><div className="cloud cloud-a"/><div className="cloud cloud-c"/>
    <Canvas orthographic camera={{ position: [17, CAMERA_OFFSET[1], 17], near: .1, far: 100, zoom: 50 }} shadows={{ type: PCFShadowMap }}
      eventSource={eventSource as RefObject<HTMLElement>} eventPrefix="client" dpr={[1, 1.6]} frameloop="demand" gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
      <Scene {...props} command={command} temporary={temporary} returning={returning} onTemporaryDrop={onTemporaryDrop}
        onFocus={(person) => setCommand((current) => ({ id: current.id + 1, kind: "focus", person }))}/>
    </Canvas>
    <div className="zoom-controls">
      <button aria-label="Zoom out" onClick={() => setCommand((current) => ({ id: current.id + 1, kind: "zoom", amount: .85 }))}><Minus size={18}/></button>
      <button aria-label="Reset view" onClick={() => setCommand((current) => ({ id: current.id + 1, kind: "reset" }))}><RotateCcw size={16}/></button>
      <button aria-label="Zoom in" onClick={() => setCommand((current) => ({ id: current.id + 1, kind: "zoom", amount: 1.15 }))}><Plus size={18}/></button>
    </div>
    {props.arrangeMode && <div className="arrange-tip">Drag a friend&apos;s land · empty sky pans · pinch to zoom</div>}
  </div>;
}
