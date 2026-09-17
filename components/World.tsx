"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Person } from "@/lib/types";
import { isSlotFree, nearestPlot, plotToWorld, positionKey, WORLD_ORIGIN_X, WORLD_ORIGIN_Y, WORLD_STAGE_HEIGHT, WORLD_STAGE_WIDTH } from "@/lib/world";
import { Plot } from "./Plot";
import { PlaneLand } from './PlaneLand';
import { MOTION } from '@/lib/motion';

type Camera = { x: number; y: number; zoom: number };
type Drag = { type: "camera"; pointerId: number; startX: number; startY: number; camera: Camera } | { type: "plot"; pointerId: number; personId: string; startX: number; startY: number; originX: number; originY: number };
type Preview = { personId: string; plotX: number; plotY: number; valid: boolean } | null;

type Props = {
  people: Person[];
  arrangeMode: boolean;
  onPeopleChange: (people: Person[]) => void;
  onCharacterClick: (person: Person) => void;
  motionPaused?: boolean;
};

export function World({ people, arrangeMode, motionPaused, onPeopleChange, onCharacterClick }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const previewRef = useRef<Preview>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 0.82 });
  const [ready, setReady] = useState(false);
  const [gliding, setGliding] = useState(false);
  const focusSpace = (person: Person) => {
    const viewport = viewportRef.current;
    if (!viewport || arrangeMode) return;
    const p = plotToWorld(person);
    const zoom = Math.min(1.2, viewport.clientWidth / 480);
    setGliding(true);
    setCamera({ x: viewport.clientWidth/2-(WORLD_ORIGIN_X+p.x)*zoom, y: viewport.clientHeight*.46-(WORLD_ORIGIN_Y+p.y+90)*zoom, zoom });
  };

  const centerWorld = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const mobile = viewport.clientWidth < 680;
    const zoom = mobile
      ? Math.max(0.47, Math.min(0.68, (viewport.clientWidth - 24) / WORLD_STAGE_WIDTH))
      : Math.min(1, viewport.clientWidth / 1060, viewport.clientHeight / 730);
    setCamera({
      x: viewport.clientWidth / 2 - WORLD_STAGE_WIDTH / 2 * zoom,
      y: viewport.clientHeight * (mobile ? .47 : .5) - WORLD_STAGE_HEIGHT / 2 * zoom,
      zoom,
    });
    setReady(true);
  }, []);

  useEffect(() => { centerWorld(); }, [centerWorld]);
  useEffect(() => {
    const onResize = () => centerWorld();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [centerWorld]);

  const beginCameraDrag = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    setGliding(false);
    dragRef.current = { type: "camera", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, camera };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const beginPlotDrag = (event: ReactPointerEvent, person: Person) => {
    if (!arrangeMode || person.owner) return;
    event.stopPropagation();
    const world = plotToWorld(person);
    dragRef.current = { type: "plot", pointerId: event.pointerId, personId: person.id, startX: event.clientX, startY: event.clientY, originX: world.x, originY: world.y };
    const next = { personId: person.id, plotX: person.plotX, plotY: person.plotY, valid: true };
    previewRef.current = next;
    setPreview(next);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.type === "camera") {
      setCamera({ ...drag.camera, x: drag.camera.x + event.clientX - drag.startX, y: drag.camera.y + event.clientY - drag.startY });
      return;
    }
    const personIndex = people.findIndex((person) => person.id === drag.personId);
    const person = people[personIndex];
    if (!person) return;
    const snapped = nearestPlot((event.clientX - drag.startX) / camera.zoom, (event.clientY - drag.startY) / camera.zoom, person);
    const valid = isSlotFree(snapped, people, personIndex);
    const next = { personId: person.id, ...snapped, valid };
    if (!previewRef.current || positionKey(next) !== positionKey(previewRef.current) || valid !== previewRef.current.valid) {
      previewRef.current = next;
      setPreview(next);
    }
  };

  const endPointer = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.type === "plot" && previewRef.current?.valid) {
      const target = previewRef.current;
      onPeopleChange(people.map((person) => person.id === drag.personId ? { ...person, plotX: target.plotX, plotY: target.plotY } : person));
    }
    dragRef.current = null;
    previewRef.current = null;
    setPreview(null);
  };

  const onWheel = (event: WheelEvent) => {
    setGliding(false);
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointX = event.clientX - rect.left;
    const pointY = event.clientY - rect.top;
    const nextZoom = Math.min(1.35, Math.max(0.3, camera.zoom * Math.exp(-event.deltaY * 0.001)));
    const worldX = (pointX - camera.x) / camera.zoom;
    const worldY = (pointY - camera.y) / camera.zoom;
    setCamera({ zoom: nextZoom, x: pointX - worldX * nextZoom, y: pointY - worldY * nextZoom });
  };

  const zoomBy = (amount: number) => setCamera((value) => ({ ...value, zoom: Math.min(1.35, Math.max(0.3, value.zoom + amount)) }));
  const movingPerson = preview ? people.find((person) => person.id === preview.personId) : null;
  const movingWorld = preview ? plotToWorld(preview) : null;
  const orderedPeople = [...people].sort((a, b) => (a.plotX + a.plotY) - (b.plotX + b.plotY) || a.plotX - b.plotX);

  return (
    <div
      ref={viewportRef}
      className={`world-viewport ${arrangeMode ? "arranging" : ""} ${motionPaused || arrangeMode ? 'motion-paused' : ''}`}
      onPointerDown={beginCameraDrag}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
    >
      <div className="sky-haze"/><div className="cloud cloud-a"/><div className="cloud cloud-b"/><div className="cloud cloud-c"/>
      <div className={`world iso-world ${ready ? "world-ready" : ""} ${gliding ? 'camera-gliding' : ''}`} style={{ transitionDuration: gliding ? `${MOTION.focusMs}ms` : undefined, width: WORLD_STAGE_WIDTH, height: WORLD_STAGE_HEIGHT, transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})` }}>
        <div className="plane-shadow"/>
        <PlaneLand people={people} selectedId={preview?.personId} onPointerDown={beginPlotDrag}/>
        {orderedPeople.map((person) => <Plot
          key={person.id}
          person={person}
          arrangeMode={arrangeMode}
          motionPaused={motionPaused}
          onFocus={focusSpace}
          selected={preview?.personId === person.id}
          onPlotPointerDown={beginPlotDrag}
          onCharacterClick={onCharacterClick}
        />)}
        {preview && movingPerson && movingWorld && <div className={`plot-ghost iso-plot-ghost ${preview.valid ? "valid" : "invalid"}`} style={{ left: WORLD_ORIGIN_X + movingWorld.x, top: WORLD_ORIGIN_Y + movingWorld.y }}><span>{preview.valid ? "drop here" : "occupied"}</span></div>}
      </div>
      <div className="zoom-controls">
        <button onClick={() => zoomBy(-0.12)} aria-label="Zoom out"><Minus size={18}/></button>
        <button onClick={() => { setGliding(true); centerWorld(); }} aria-label="Reset view"><RotateCcw size={16}/></button>
        <button onClick={() => zoomBy(0.12)} aria-label="Zoom in"><Plus size={18}/></button>
      </div>
      {arrangeMode && <div className="arrange-tip">Drag a friend’s plot · it snaps to the shared grid</div>}
    </div>
  );
}
