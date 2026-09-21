import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Person } from "./types";
import {
  CHARACTER_RETURN_MS,
  CharacterReturnTimers,
  beginArrangement,
  gestureOwner,
  isCharacterCellValid,
  moveLandInArrangement,
  pointerMoved,
  scenePointToPlacement,
  type CharacterPlacement,
} from "./world-interactions";

const person = (id: string, plotX: number, plotY: number, owner = false) => ({
  id, nickname: id, species: "fox", color: "#fff", accent: "#eee", accessory: "none",
  plotX, plotY, ground: "grass", home: "cottage", pills: [], owner, scene: "new",
}) as Person;

describe("world interactions", () => {
  it("keeps Arrange edits isolated until Done and restores the entry layout on Cancel", () => {
    const stored = [person("owner", 0, 0, true), person("friend", 1, 0)];
    const draft = beginArrangement(stored);
    const edited = moveLandInArrangement(draft, "friend", { plotX: 2, plotY: 1 });
    expect(stored[1]).toMatchObject({ plotX: 1, plotY: 0 });
    expect(edited[1]).toMatchObject({ plotX: 2, plotY: 1 });
    expect(beginArrangement(stored)).toEqual(stored);
  });

  it("keeps the owner fixed and rejects occupied chunk coordinates", () => {
    const layout = [person("owner", 0, 0, true), person("a", 1, 0), person("b", 0, 1)];
    expect(moveLandInArrangement(layout, "owner", { plotX: 3, plotY: 3 })).toBe(layout);
    expect(moveLandInArrangement(layout, "a", { plotX: 0, plotY: 1 })).toBe(layout);
  });

  it.each([1, 5, 10, 25])("keeps %i lands on exact five-cell chunk boundaries", (count) => {
    const layout = Array.from({ length: count }, (_, index) => person(String(index), index % 5, Math.floor(index / 5)));
    expect(layout.every((land) => (land.plotX * 5) % 5 === 0 && (land.plotY * 5) % 5 === 0)).toBe(true);
    expect(new Set(layout.map((land) => `${land.plotX},${land.plotY}`)).size).toBe(count);
  });

  it("maps scene points to land-local cells and validates blocked and occupied drops", () => {
    const people = [person("a", 0, 0), person("b", 2, -1)];
    expect(scenePointToPlacement(people, 11.4, -2.2)).toEqual({ landId: "b", tileX: 1, tileY: 2 });
    expect(scenePointToPlacement(people, 7, 7)).toBeNull();
    const blocked = new Map<string, Set<string>>([["b", new Set(["1,2"])]]);
    const occupants = new Map<string, CharacterPlacement>([["other", { landId: "b", tileX: 2, tileY: 2 }]]);
    expect(isCharacterCellValid({ landId: "b", tileX: 1, tileY: 2 }, blocked, occupants, "moving")).toBe(false);
    expect(isCharacterCellValid({ landId: "b", tileX: 2, tileY: 2 }, blocked, occupants, "moving")).toBe(false);
    expect(isCharacterCellValid({ landId: "b", tileX: 3, tileY: 2 }, blocked, occupants, "moving")).toBe(true);
  });

  it("distinguishes a tap from a completed drag", () => {
    expect(pointerMoved({ x: 10, y: 10 }, { x: 14, y: 13 })).toBe(false);
    expect(pointerMoved({ x: 10, y: 10 }, { x: 17, y: 10 })).toBe(true);
  });

  it("hands two-finger touch to the camera and keeps one-finger object ownership", () => {
    expect(gestureOwner(1, "character", false)).toBe("character");
    expect(gestureOwner(1, "land", true)).toBe("land");
    expect(gestureOwner(2, "land", true)).toBe("camera");
    expect(gestureOwner(1, "background", true)).toBe("camera");
  });
});

describe("temporary Character return timers", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("maintains independent deadlines and restarts only the moved Character", () => {
    vi.setSystemTime(new Date("2026-09-19T00:00:00Z"));
    const expired: string[] = [];
    const timers = new CharacterReturnTimers((id) => expired.push(id));
    timers.schedule("ren");
    vi.advanceTimersByTime(60_000);
    timers.schedule("maya");
    vi.advanceTimersByTime(60_000);
    timers.schedule("ren");
    vi.advanceTimersByTime(120_000);
    expect(expired).toEqual(["maya"]);
    vi.advanceTimersByTime(60_000);
    expect(expired).toEqual(["maya", "ren"]);
    timers.clear();
  });

  it("reconciles elapsed deadlines after a background pause", () => {
    let now = 1_000;
    const expired: string[] = [];
    const timers = new CharacterReturnTimers((id) => expired.push(id), () => now);
    timers.schedule("ren", now + CHARACTER_RETURN_MS);
    now += CHARACTER_RETURN_MS + 1;
    timers.reconcile();
    expect(expired).toEqual(["ren"]);
    timers.clear();
  });
});
