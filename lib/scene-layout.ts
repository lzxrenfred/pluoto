import type { Person } from "./types";

export type Placement = { kind:"tree"|"bush"|"flowers"|"lamp"|"bench"|"table"|"path"|"mailbox";tileX:number;tileY:number;variant?:"blossom"|"tall" };
export const LAND_SIGN_CELL={tileX:2,tileY:4} as const;
export const placements:Record<Person["scene"],Placement[]>={
  ren:[{kind:"path",tileX:1,tileY:2},{kind:"path",tileX:1,tileY:3},{kind:"path",tileX:1,tileY:4},{kind:"tree",tileX:4,tileY:0,variant:"tall"},{kind:"tree",tileX:3,tileY:1},{kind:"tree",tileX:0,tileY:3},{kind:"bush",tileX:2,tileY:0},{kind:"bush",tileX:4,tileY:2},{kind:"bush",tileX:3,tileY:4},{kind:"flowers",tileX:0,tileY:2},{kind:"flowers",tileX:0,tileY:4},{kind:"flowers",tileX:4,tileY:4},{kind:"mailbox",tileX:2,tileY:2},{kind:"bench",tileX:4,tileY:3}],
  sarah:[{kind:"path",tileX:1,tileY:2},{kind:"path",tileX:1,tileY:3},{kind:"path",tileX:1,tileY:4},{kind:"tree",tileX:4,tileY:0},{kind:"tree",tileX:4,tileY:4,variant:"tall"},{kind:"lamp",tileX:3,tileY:3},{kind:"bench",tileX:4,tileY:2}],
  maya:[{kind:"tree",tileX:1,tileY:1,variant:"blossom"},{kind:"tree",tileX:4,tileY:4},{kind:"table",tileX:2,tileY:3},{kind:"bench",tileX:3,tileY:3},{kind:"flowers",tileX:0,tileY:4},{kind:"flowers",tileX:4,tileY:0}],
  wei:[{kind:"tree",tileX:4,tileY:0,variant:"tall"},{kind:"tree",tileX:0,tileY:4},{kind:"lamp",tileX:4,tileY:3},{kind:"bench",tileX:1,tileY:4},{kind:"bush",tileX:0,tileY:1},{kind:"flowers",tileX:4,tileY:1}],
  james:[{kind:"tree",tileX:0,tileY:4},{kind:"bench",tileX:3,tileY:3},{kind:"lamp",tileX:4,tileY:1},{kind:"bush",tileX:1,tileY:0}],
  kai:[{kind:"tree",tileX:4,tileY:0},{kind:"tree",tileX:0,tileY:4},{kind:"lamp",tileX:4,tileY:3},{kind:"bench",tileX:2,tileY:4}],
  new:[{kind:"tree",tileX:4,tileY:0},{kind:"tree",tileX:0,tileY:4},{kind:"bush",tileX:4,tileY:3},{kind:"flowers",tileX:1,tileY:4}],
};
export const houseCells:Record<Person["scene"],{tileX:number;tileY:number}>={ren:{tileX:0,tileY:0},sarah:{tileX:1,tileY:0},maya:{tileX:2,tileY:0},wei:{tileX:0,tileY:1},james:{tileX:1,tileY:0},kai:{tileX:0,tileY:1},new:{tileX:1,tileY:0}};
export const characterCells:Record<Person["scene"],{tileX:number;tileY:number}>={ren:{tileX:3,tileY:2},sarah:{tileX:1,tileY:3},maya:{tileX:3,tileY:4},wei:{tileX:3,tileY:2},james:{tileX:3,tileY:3},kai:{tileX:3,tileY:2},new:{tileX:3,tileY:3}};
