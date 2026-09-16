"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Person } from "@/lib/types";
import { PLOT_SIZE, TILE_SIZE, plotToWorld } from "@/lib/world";
import { Character } from "./Character";

type Props = {
  person: Person;
  arrangeMode: boolean;
  selected?: boolean;
  onPlotPointerDown: (event: ReactPointerEvent, person: Person) => void;
  onCharacterClick: (person: Person) => void;
};

const objectPositions: Record<Person["scene"], { trees: [number, number][]; flowers: [number, number][] }> = {
  ren: { trees: [[26, 41], [274, 228]], flowers: [[37, 248], [257, 47]] },
  sarah: { trees: [[28, 46], [277, 70]], flowers: [[42, 250], [269, 234]] },
  maya: { trees: [[37, 37], [262, 221]], flowers: [[260, 51], [82, 253]] },
  wei: { trees: [[271, 48]], flowers: [[35, 240], [274, 248]] },
  james: { trees: [[40, 43], [270, 62]], flowers: [[278, 251]] },
  kai: { trees: [[32, 245]], flowers: [[270, 48], [276, 250]] },
  new: { trees: [[35, 45], [272, 242]], flowers: [[263, 53]] },
};

function Tree({ x, y, palm = false }: { x: number; y: number; palm?: boolean }) {
  return <div className={`tree ${palm ? "palm" : ""}`} style={{ left: x, top: y }}><i/><b/><em/></div>;
}

function Flowers({ x, y }: { x: number; y: number }) {
  return <div className="flowers" style={{ left: x, top: y }}><i/><i/><i/></div>;
}

function House({ type }: { type: Person["home"] }) {
  if (type === "tent") return <div className="tent"><i/><b/></div>;
  if (type === "kiosk") return <div className="kiosk"><div className="awning"/><span>slow<br/>coffee</span><i/></div>;
  return <div className={`house house-${type}`}><div className="roof"/><div className="wall"><span className="window"/><span className="door"/></div><i className="chimney"/></div>;
}

function SceneProps({ scene }: { scene: Person["scene"] }) {
  if (scene === "ren") return <><div className="mailbox">♥</div><div className="bench"><i/><i/></div></>;
  if (scene === "maya") return <><div className="deckchair"><i/><b/></div><div className="tiny-pond"/></>;
  if (scene === "wei") return <><div className="round-table">☕</div><div className="lamp">●</div></>;
  if (scene === "james") return <><div className="campfire"><i/><b/>✦</div><div className="log-seat"/></>;
  if (scene === "kai") return <><div className="string-lights">●　●　●　●</div><div className="chalkboard">today<br/>be soft</div></>;
  if (scene === "sarah") return <><div className="picnic">☕</div><div className="hedge"/></>;
  return <div className="bench"><i/><i/></div>;
}

export function Plot({ person, arrangeMode, selected, onPlotPointerDown, onCharacterClick }: Props) {
  const world = plotToWorld(person);
  const positions = objectPositions[person.scene];
  const style = {
    width: PLOT_SIZE,
    height: PLOT_SIZE,
    transform: `translate3d(${world.x}px, ${world.y}px, 0)`,
    "--tile-size": `${TILE_SIZE}px`,
  } as CSSProperties;

  return (
    <div
      className={`plot ground-${person.ground} ${arrangeMode && !person.owner ? "plot-movable" : ""} ${selected ? "plot-selected" : ""}`}
      style={style}
      data-person={person.id}
      onPointerDown={(event) => onPlotPointerDown(event, person)}
    >
      <div className="plot-grid" />
      <div className="plot-edge plot-edge-top"/><div className="plot-edge plot-edge-right"/>
      <div className="plot-label"><span>{person.nickname}</span>{person.owner && <b>YOU</b>}</div>
      {positions.trees.map(([x, y], index) => <Tree key={`t${index}`} x={x} y={y} palm={person.scene === "maya" && index === 0}/>)}
      {positions.flowers.map(([x, y], index) => <Flowers key={`f${index}`} x={x} y={y}/>)}
      <House type={person.home}/>
      <SceneProps scene={person.scene}/>
      {person.bubble && <div className="bubble"><span>{person.bubble}</span></div>}
      <button
        className={`character-button roam roam-${person.id}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onCharacterClick(person); }}
        aria-label={`Open ${person.nickname}'s card`}
      >
        <Character species={person.species} color={person.color} accent={person.accent} accessory={person.accessory}/>
      </button>
      {arrangeMode && !person.owner && <div className="drag-handle">hold + move</div>}
    </div>
  );
}
