import type { Person } from "./types";
import { PLOT_TILES, isSlotFree, type PlotPosition, type TilePosition } from "./world";

export const CHARACTER_DRAG_THRESHOLD = 6;
export const CHARACTER_RETURN_MS = 3 * 60 * 1000;

export type CharacterPlacement = TilePosition & {
  landId: string;
  temporary?: boolean;
  returnAt?: number;
};

export type GestureTarget = "background" | "character" | "land";
export type GestureOwner = "camera" | "character" | "land";

export function pointerMoved(start: { x: number; y: number }, current: { x: number; y: number }, threshold = CHARACTER_DRAG_THRESHOLD) {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

export function gestureOwner(pointerCount: number, target: GestureTarget, arrangeMode: boolean): GestureOwner {
  if (pointerCount > 1 || target === "background") return "camera";
  if (arrangeMode) return target === "land" ? "land" : "camera";
  return target === "character" ? "character" : "camera";
}

export function findLandAtScenePoint(people: Person[], x: number, z: number) {
  return people.find((person) => {
    const originX = person.plotX * PLOT_TILES;
    const originZ = person.plotY * PLOT_TILES;
    return x >= originX && x < originX + PLOT_TILES && z >= originZ && z < originZ + PLOT_TILES;
  });
}

export function scenePointToPlacement(people: Person[], x: number, z: number): CharacterPlacement | null {
  const land = findLandAtScenePoint(people, x, z);
  if (!land) return null;
  return { landId: land.id, tileX: Math.floor(x - land.plotX * PLOT_TILES), tileY: Math.floor(z - land.plotY * PLOT_TILES) };
}

export function isCharacterCellValid(
  candidate: CharacterPlacement | null,
  blockedByLand: ReadonlyMap<string, ReadonlySet<string>>,
  occupants: ReadonlyMap<string, CharacterPlacement>,
  movingCharacterId: string,
) {
  if (!candidate) return false;
  if (candidate.tileX < 0 || candidate.tileY < 0 || candidate.tileX >= PLOT_TILES || candidate.tileY >= PLOT_TILES) return false;
  const key = `${candidate.tileX},${candidate.tileY}`;
  if (blockedByLand.get(candidate.landId)?.has(key)) return false;
  return ![...occupants.entries()].some(([id, placement]) => (
    id !== movingCharacterId && placement.landId === candidate.landId &&
    placement.tileX === candidate.tileX && placement.tileY === candidate.tileY
  ));
}

export function beginArrangement(people: Person[]) {
  return people.map((person) => ({ ...person }));
}

export function moveLandInArrangement(people: Person[], id: string, target: PlotPosition) {
  const movingIndex = people.findIndex((person) => person.id === id);
  if (movingIndex < 0 || people[movingIndex].owner || !isSlotFree(target, people, movingIndex)) return people;
  return people.map((person, index) => index === movingIndex ? { ...person, ...target } : person);
}

export class CharacterReturnTimers {
  private deadlines = new Map<string, number>();
  private handles = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly onExpire: (id: string) => void,
    private readonly now: () => number = Date.now,
    private readonly scheduleTask: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> = (callback, delay) => globalThis.setTimeout(callback, delay),
    private readonly clearTask: (handle: ReturnType<typeof setTimeout>) => void = (handle) => globalThis.clearTimeout(handle),
  ) {}

  schedule(id: string, returnAt = this.now() + CHARACTER_RETURN_MS) {
    this.cancel(id);
    this.deadlines.set(id, returnAt);
    const run = () => {
      const deadline = this.deadlines.get(id);
      if (deadline === undefined) return;
      const remaining = deadline - this.now();
      if (remaining > 0) {
        this.handles.set(id, this.scheduleTask(run, remaining));
        return;
      }
      this.deadlines.delete(id);
      this.handles.delete(id);
      this.onExpire(id);
    };
    this.handles.set(id, this.scheduleTask(run, Math.max(0, returnAt - this.now())));
    return returnAt;
  }

  reconcile() {
    const current = this.now();
    [...this.deadlines.entries()].forEach(([id, deadline]) => {
      if (deadline <= current) {
        this.cancel(id);
        this.onExpire(id);
      }
    });
  }

  cancel(id: string) {
    const handle = this.handles.get(id);
    if (handle !== undefined) this.clearTask(handle);
    this.handles.delete(id);
    this.deadlines.delete(id);
  }

  clear() {
    [...this.handles.values()].forEach((handle) => this.clearTask(handle));
    this.handles.clear();
    this.deadlines.clear();
  }
}
