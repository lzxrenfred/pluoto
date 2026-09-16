"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Person } from "@/lib/types";
import { isSlotFree, nearestPlot, PLOT_SIZE, plotToWorld, positionKey } from "@/lib/world";
import { Plot } from "./Plot";

type Camera = { x: number; y: number; zoom: number };
type Drag = { type: "camera"; pointerId: number; startX: number; startY: number; camera: Camera } | { type: "plot"; pointerId: number; personId: string; startX: number; startY: number; originX: number; originY: number };
type Preview = { personId: string; plotX: number; plotY: number; valid: boolean } | null;

type Props = {
  people: Person[];
  arrangeMode: boolean;
  onPeopleChange: (people: Person[]) => void;
  onCharacterClick: (person: Person) => void;
};

export function World({ people, arrangeMode, onPeopleChange, onCharacterClick }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const previewRef = useRef<Preview>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 0.82 });
  const [ready, setReady] = useState(false);

  const centerWorld = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const mobile = viewport.clientWidth < 680;
    const zoom = mobile ? Math.max(0.34, Math.min(0.43, viewport.clientWidth / 960)) : Math.min(0.88, viewport.clientWidth / 1180, viewport.clientHeight / 900);
    // The six-person demo spans x=-1..1 and y=-1..1, whose visual centre is
    // the centre of the owner's plot (160,160) rather than world origin (0,0).
    setCamera({ x: viewport.clientWidth / 2 - (PLOT_SIZE / 2) * zoom, y: viewport.clientHeight * 0.49 - (PLOT_SIZE / 2) * zoom, zoom });
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

  return (
    <div
      ref={viewportRef}
      className={`world-viewport ${arrangeMode ? "arranging" : ""}`}
      onPointerDown={beginCameraDrag}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
    >
      <div className="sky-haze"/><div className="cloud cloud-a"/><div className="cloud cloud-b"/><div className="cloud cloud-c"/>
      <div className="world-grid" style={{ backgroundPosition: `${camera.x}px ${camera.y}px`, backgroundSize: `${PLOT_SIZE * camera.zoom}px ${PLOT_SIZE * camera.zoom}px` }}/>
      <div className={`world ${ready ? "world-ready" : ""}`} style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})` }}>
        {people.map((person) => <Plot key={person.id} person={person} arrangeMode={arrangeMode} selected={preview?.personId === person.id} onPlotPointerDown={beginPlotDrag} onCharacterClick={onCharacterClick}/>)}
        {preview && movingPerson && <div className={`plot-ghost ${preview.valid ? "valid" : "invalid"}`} style={{ transform: `translate3d(${preview.plotX * PLOT_SIZE}px, ${preview.plotY * PLOT_SIZE}px, 0)` }}><span>{preview.valid ? "drop here" : "occupied"}</span></div>}
      </div>
      <div className="zoom-controls">
        <button onClick={() => zoomBy(-0.12)} aria-label="Zoom out"><Minus size={18}/></button>
        <button onClick={centerWorld} aria-label="Reset view"><RotateCcw size={16}/></button>
        <button onClick={() => zoomBy(0.12)} aria-label="Zoom in"><Plus size={18}/></button>
      </div>
      {arrangeMode && <div className="arrange-tip">Drag a friend’s plot · it snaps to the shared grid</div>}
    </div>
  );
}
