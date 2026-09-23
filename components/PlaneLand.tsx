"use client";

import type { PointerEvent } from 'react';
import type { Person } from '@/lib/types';
import { exteriorFaces, spaceTiles, tileToIso, LAND_DEPTH, WORLD_ORIGIN_X, WORLD_ORIGIN_Y, WORLD_STAGE_WIDTH, WORLD_STAGE_HEIGHT } from '@/lib/world';

const colors = { grass: '#a7d38c', stone: '#d9d9d9', earth: '#dfb581', sand: '#f3e6d7', meadow: '#a8c894', clay: '#c99680' };
function point(x: number, y: number, z = 0) {
  const p = tileToIso({ tileX: x, tileY: y }, z);
  return `${WORLD_ORIGIN_X + p.x},${WORLD_ORIGIN_Y + p.y}`;
}

/** One terrain mesh, with ownership retained on each of its logical cells. */
export function PlaneLand({ people, selectedId, onPointerDown }: {
  people: Person[]; selectedId?: string; onPointerDown: (event: PointerEvent, person: Person) => void;
}) {
  return <svg className="plane-terrain" width={WORLD_STAGE_WIDTH} height={WORLD_STAGE_HEIGHT} aria-label="Plane terrain">
    <g pointerEvents="none">
      {exteriorFaces(people).map(({ tileX: x, tileY: y, axis }) => {
        const a = axis === 'x' ? [x + 1, y] : [x, y + 1];
        const b = [x + 1, y + 1];
        return <polygon key={`${x},${y},${axis}`} fill={axis === 'x' ? '#96775f' : '#b18e72'}
          points={`${point(a[0], a[1])} ${point(b[0], b[1])} ${point(b[0], b[1], -LAND_DEPTH)} ${point(a[0], a[1], -LAND_DEPTH)}`}/>;
      })}
    </g>
    {spaceTiles(people).map(({ tileX: x, tileY: y, space }) => <polygon
      key={`${x},${y}`} data-space={space.id} data-tile={`${x},${y}`}
      fill={colors[space.ground]} stroke="rgba(65,89,61,.18)" strokeWidth=".6"
      opacity={selectedId === space.id ? .55 : 1}
      points={`${point(x,y)} ${point(x+1,y)} ${point(x+1,y+1)} ${point(x,y+1)}`}
      onPointerDown={(event) => onPointerDown(event, space)}
    />)}
  </svg>;
}
