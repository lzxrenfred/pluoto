import { characterCells, houseCells, LAND_SIGN_CELL, placements } from "./scene-layout";
import type { LandModelId, LandObject, LandRotation, Person } from "./types";

export const LAND_MODEL_OPTIONS: Array<{ id: LandModelId; label: string; group: string }> = [
  { id: "house.cottage", label: "Cottage", group: "Homes" }, { id: "house.studio", label: "Studio", group: "Homes" },
  { id: "house.cabin", label: "Cabin", group: "Homes" }, { id: "house.tent", label: "Tent", group: "Homes" },
  { id: "house.kiosk", label: "Kiosk", group: "Homes" }, { id: "tree.round", label: "Tree", group: "Nature" },
  { id: "tree.tall", label: "Tall tree", group: "Nature" }, { id: "tree.blossom", label: "Blossom", group: "Nature" },
  { id: "bush", label: "Bush", group: "Nature" }, { id: "flowers", label: "Flowers", group: "Nature" },
  { id: "rock.cluster", label: "Rocks", group: "Nature" }, { id: "bench", label: "Bench", group: "Props" },
  { id: "lamp", label: "Lamp", group: "Props" }, { id: "table", label: "Table", group: "Props" },
  { id: "mailbox", label: "Mailbox", group: "Props" }, { id: "path", label: "Path", group: "Ground" },
];

const validModels = new Set(LAND_MODEL_OPTIONS.map(option => option.id));
const solidModels = new Set<LandModelId>(LAND_MODEL_OPTIONS.map(option => option.id).filter(id => id !== "path" && id !== "flowers"));
const homeModel = (home: Person["home"]): LandModelId => `house.${home}` as LandModelId;

export function landObjectFootprint(object: Pick<LandObject, "modelId" | "rotation">) {
  let width = object.modelId.startsWith("house.") ? 2 : object.modelId === "rock.cluster" ? 2 : 1;
  let height = object.modelId.startsWith("house.") ? 2 : 1;
  if ((object.rotation === 90 || object.rotation === 270) && width !== height) [width, height] = [height, width];
  return { width, height };
}

export function footprintCells(object: LandObject) {
  const { width, height } = landObjectFootprint(object);
  return Array.from({ length: width * height }, (_, index) => ({ tileX: object.tileX + index % width, tileY: object.tileY + Math.floor(index / width) }));
}

export function landObjectsForPerson(person: Person): LandObject[] {
  if (person.landObjects?.length) return person.landObjects.map(item => ({ ...item }));
  const house = houseCells[person.scene];
  const result: LandObject[] = [{ id: `legacy-${person.id}-home`, modelId: homeModel(person.home), tileX: house.tileX, tileY: house.tileY, rotation: 0 }];
  placements[person.scene].forEach((item, index) => {
    const modelId: LandModelId = item.kind === "tree" ? `tree.${item.variant === "tall" ? "tall" : item.variant === "blossom" ? "blossom" : "round"}` : item.kind;
    let candidate: LandObject = { id: `legacy-${person.id}-${item.kind}-${index}`, modelId, tileX: item.tileX, tileY: item.tileY, rotation: 0 };
    if (!isLandObjectPlacementValid(result, candidate)) {
      outer: for (let tileY = 0; tileY < 5; tileY += 1) for (let tileX = 0; tileX < 5; tileX += 1) {
        const moved = { ...candidate, tileX, tileY };
        if (isLandObjectPlacementValid(result, moved)) { candidate = moved; break outer; }
      }
    }
    result.push(candidate);
  });
  return result;
}

export function validateLandObjects(input: LandObject[]) {
  const ids = new Set<string>();
  const occupied = new Set([`${LAND_SIGN_CELL.tileX},${LAND_SIGN_CELL.tileY}`]);
  const normalized = input.map((item): LandObject => ({ ...item, tileX: Number(item.tileX), tileY: Number(item.tileY), rotation: Number(item.rotation) as LandRotation }));
  for (const item of normalized) {
    if (!item.id || item.id.length > 80 || ids.has(item.id)) throw new Error("Every land object needs a unique stable ID.");
    if (!validModels.has(item.modelId)) throw new Error("That model is not supported on this land.");
    if (![0, 90, 180, 270].includes(item.rotation) || !Number.isInteger(item.tileX) || !Number.isInteger(item.tileY)) throw new Error("Objects must use integer grid positions and 90° rotations.");
    ids.add(item.id);
    const cells = footprintCells(item);
    if (cells.some(cell => cell.tileX < 0 || cell.tileY < 0 || cell.tileX >= 5 || cell.tileY >= 5)) throw new Error("An object extends outside the 5 × 5 land.");
    if (!solidModels.has(item.modelId)) continue;
    for (const cell of cells) {
      const key = `${cell.tileX},${cell.tileY}`;
      if (occupied.has(key)) throw new Error("Solid objects cannot overlap each other or the name sign.");
      occupied.add(key);
    }
  }
  if (occupied.size >= 25) throw new Error("Leave at least one open cell for your Character.");
  return normalized;
}

export function isLandObjectPlacementValid(objects: LandObject[], candidate: LandObject, ignoreId?: string) {
  try { validateLandObjects([...objects.filter(item => item.id !== ignoreId && item.id !== candidate.id), candidate]); return true; } catch { return false; }
}

export function blockedLandCells(person: Person) {
  const cells = new Set<string>([`${LAND_SIGN_CELL.tileX},${LAND_SIGN_CELL.tileY}`]);
  for (const object of landObjectsForPerson(person)) if (solidModels.has(object.modelId)) footprintCells(object).forEach(cell => cells.add(`${cell.tileX},${cell.tileY}`));
  return cells;
}

export function characterCellForPerson(person: Person) {
  const blocked = blockedLandCells(person);
  const preferred = characterCells[person.scene];
  if (!blocked.has(`${preferred.tileX},${preferred.tileY}`)) return preferred;
  for (let tileY = 0; tileY < 5; tileY += 1) for (let tileX = 0; tileX < 5; tileX += 1) if (!blocked.has(`${tileX},${tileY}`)) return { tileX, tileY };
  return { tileX: 0, tileY: 0 };
}
