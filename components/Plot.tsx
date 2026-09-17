"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { Person } from "@/lib/types";
import {
  PLOT_TILES,
  WORLD_ORIGIN_X,
  WORLD_ORIGIN_Y,
  plotToGrid,
  plotToWorld,
  tileToIso,
  depthOrder,
} from "@/lib/world";
import { Character } from "./Character";
import { useGridMotion } from '@/lib/motion';
import { MotionBubble } from './MotionBubble';

type Props = {
  person: Person;
  arrangeMode: boolean;
  selected?: boolean;
  motionPaused?: boolean;
  onFocus: (person: Person) => void;
  onPlotPointerDown: (event: ReactPointerEvent, person: Person) => void;
  onCharacterClick: (person: Person) => void;
};

export type Placement = {
  kind: "tree" | "bush" | "flowers" | "lamp" | "bench" | "table" | "path" | "mailbox";
  tileX: number;
  tileY: number;
  variant?: "blossom" | "tall";
};

export const placements: Record<Person["scene"], Placement[]> = {
  ren: [
    { kind: "path", tileX: 1, tileY: 2 }, { kind: "path", tileX: 1, tileY: 3 }, { kind: "path", tileX: 1, tileY: 4 },
    { kind: "tree", tileX: 4, tileY: 0, variant: "tall" }, { kind: "tree", tileX: 3, tileY: 1 }, { kind: "tree", tileX: 0, tileY: 3 },
    { kind: "bush", tileX: 2, tileY: 0 }, { kind: "bush", tileX: 4, tileY: 2 }, { kind: "bush", tileX: 3, tileY: 4 },
    { kind: "flowers", tileX: 0, tileY: 2 }, { kind: "flowers", tileX: 2, tileY: 4 }, { kind: "flowers", tileX: 4, tileY: 4 },
    { kind: "mailbox", tileX: 2, tileY: 2 }, { kind: "bench", tileX: 4, tileY: 3 },
  ],
  sarah: [
    { kind: "path", tileX: 1, tileY: 2 }, { kind: "path", tileX: 1, tileY: 3 }, { kind: "path", tileX: 1, tileY: 4 },
    { kind: "tree", tileX: 4, tileY: 0 }, { kind: "tree", tileX: 4, tileY: 4, variant: "tall" },
    { kind: "lamp", tileX: 3, tileY: 3 }, { kind: "bench", tileX: 4, tileY: 2 },
  ],
  maya: [
    { kind: "tree", tileX: 1, tileY: 1, variant: "blossom" }, { kind: "tree", tileX: 4, tileY: 4 },
    { kind: "table", tileX: 2, tileY: 3 }, { kind: "bench", tileX: 3, tileY: 3 },
    { kind: "flowers", tileX: 0, tileY: 4 }, { kind: "flowers", tileX: 4, tileY: 0 },
  ],
  wei: [
    { kind: "tree", tileX: 4, tileY: 0, variant: "tall" }, { kind: "tree", tileX: 0, tileY: 4 },
    { kind: "lamp", tileX: 4, tileY: 3 }, { kind: "bench", tileX: 2, tileY: 4 },
    { kind: "bush", tileX: 0, tileY: 1 }, { kind: "flowers", tileX: 4, tileY: 1 },
  ],
  james: [
    { kind: "tree", tileX: 0, tileY: 4 }, { kind: "bench", tileX: 3, tileY: 3 },
    { kind: "lamp", tileX: 4, tileY: 1 }, { kind: "bush", tileX: 1, tileY: 0 },
  ],
  kai: [
    { kind: "tree", tileX: 4, tileY: 0 }, { kind: "tree", tileX: 0, tileY: 4 },
    { kind: "lamp", tileX: 4, tileY: 3 }, { kind: "bench", tileX: 2, tileY: 4 },
  ],
  new: [
    { kind: "tree", tileX: 4, tileY: 0 }, { kind: "tree", tileX: 0, tileY: 4 },
    { kind: "bush", tileX: 4, tileY: 3 }, { kind: "flowers", tileX: 1, tileY: 4 },
  ],
};

export const houseCells: Record<Person["scene"], { tileX: number; tileY: number }> = {
  ren: { tileX: 0, tileY: 0 },
  sarah: { tileX: 1, tileY: 0 },
  maya: { tileX: 2, tileY: 0 },
  wei: { tileX: 0, tileY: 1 },
  james: { tileX: 1, tileY: 0 },
  kai: { tileX: 0, tileY: 1 },
  new: { tileX: 1, tileY: 0 },
};

export const characterCells: Record<Person["scene"], { tileX: number; tileY: number }> = {
  ren: { tileX: 3, tileY: 2 },
  sarah: { tileX: 1, tileY: 3 },
  maya: { tileX: 3, tileY: 4 },
  wei: { tileX: 3, tileY: 2 },
  james: { tileX: 3, tileY: 3 },
  kai: { tileX: 3, tileY: 2 },
  new: { tileX: 3, tileY: 3 },
};

function localPoint(tileX: number, tileY: number, elevation = 0) {
  return tileToIso({ tileX, tileY }, elevation);
}

function GridObject({ tileX, tileY, plotX, plotY, children, className = "", footprintX = 1, footprintY = 1 }: {
  tileX: number; tileY: number; plotX: number; plotY: number; children: ReactNode; className?: string; footprintX?: number; footprintY?: number;
}) {
  const anchor = localPoint(tileX + footprintX / 2, tileY + footprintY / 2);
  const depth = depthOrder(plotX * PLOT_TILES + tileX + footprintX / 2, plotY * PLOT_TILES + tileY + footprintY / 2);
  return <div className={`iso-object ${className}`} style={{ left: anchor.x, top: anchor.y, zIndex: className === 'iso-path-anchor' ? 10 : depth }}>{children}</div>;
}

function IsoHouse({ type }: { type: Person["home"] }) {
  return <div className={`iso-house iso-house-${type}`}><div className="iso-house-roof"/><div className="iso-house-front"><i/><b/></div><div className="iso-house-side"/></div>;
}

function EnvironmentObject({ placement }: { placement: Placement }) {
  if (placement.kind === "tree") return <div className={`iso-tree ${placement.variant ? `iso-tree-${placement.variant}` : ""}`}><i/><b/><em/></div>;
  if (placement.kind === "bush") return <div className="iso-bush"><i/><b/></div>;
  if (placement.kind === "flowers") return <div className="iso-flowers"><i/><i/><i/></div>;
  if (placement.kind === "lamp") return <div className="iso-lamp"><i/></div>;
  if (placement.kind === "bench") return <div className="iso-bench"><i/><b/></div>;
  if (placement.kind === "table") return <div className="iso-table"><i/></div>;
  if (placement.kind === "mailbox") return <div className="iso-mailbox"><i/></div>;
  return <div className="iso-path-tile"/>;
}

export function Plot({ person, arrangeMode, selected, motionPaused, onFocus, onPlotPointerDown, onCharacterClick }: Props) {
  const world = plotToWorld(person);
  const grid = plotToGrid(person);
  const house = houseCells[person.scene];
  const blocked = [...placements[person.scene].filter(p => p.kind !== 'path'), ...Array.from({length:4}, (_,i) => ({tileX:house.tileX+i%2,tileY:house.tileY+Math.floor(i/2)}))];
  const character = useGridMotion(characterCells[person.scene], blocked, !arrangeMode && !motionPaused && ['ren','sarah'].includes(person.id), person.id === 'ren' ? 1500 : 8000);
  const characterAnchor = localPoint(character.tileX + .5, character.tileY + .5);
  const style = {
    left: WORLD_ORIGIN_X + world.x,
    top: WORLD_ORIGIN_Y + world.y,
  } as CSSProperties;

  return (
    <div
      className={`iso-plot ${arrangeMode && !person.owner ? "plot-movable" : ""} ${selected ? "plot-selected" : ""}`}
      style={style}
      data-person={person.id}
      onPointerDown={(event) => onPlotPointerDown(event, person)}
    >
      <GridObject tileX={house.tileX} tileY={house.tileY} footprintX={2} footprintY={2} plotX={person.plotX} plotY={person.plotY} className="iso-house-anchor">
        <IsoHouse type={person.home}/>
      </GridObject>
      {placements[person.scene].map((placement, index) => <GridObject
        key={`${placement.kind}-${placement.tileX}-${placement.tileY}-${index}`}
        tileX={placement.tileX}
        tileY={placement.tileY}
        plotX={person.plotX}
        plotY={person.plotY}
        className={`iso-${placement.kind}-anchor`}
      ><EnvironmentObject placement={placement}/></GridObject>)}
      <button className="iso-plot-label" aria-label={`Focus ${person.nickname}'s Space`} onPointerDown={e => e.stopPropagation()} onClick={() => onFocus(person)} style={{ left: localPoint(.5, 4.5).x, top: localPoint(.5, 4.5).y, zIndex: 9000 }}><span>{person.nickname}</span>{person.owner && <b>YOU</b>}</button>
      <MotionBubble text={person.bubble} style={{ left: characterAnchor.x, top: characterAnchor.y - 45, zIndex: 9500 }}/>
      <button
        className="iso-character-button"
        style={{ left: characterAnchor.x, top: characterAnchor.y, zIndex: depthOrder(grid.tileX + character.tileX + .5, grid.tileY + character.tileY + .5) }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onCharacterClick(person); }}
        aria-label={`Open ${person.nickname}'s card`}
      >
        <span className="inhabitant-shadow"/>
        <span className={`inhabitant-pose ${character.moving ? 'is-walking' : 'is-resting'}`} style={{display:'block', transform:`translateY(${-character.lift}px) scaleX(${character.headingX-character.headingY < 0 ? -1 : 1})`}}>
          <Character className="plane-character" species={person.species} color={person.color} accent={person.accent} accessory={person.accessory} size={48}/>
        </span>
      </button>
      {arrangeMode && !person.owner && <div className="iso-drag-handle">move</div>}
    </div>
  );
}
