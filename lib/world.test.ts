import { describe, expect, it } from "vitest";
import { ISO_TILE_HEIGHT, ISO_TILE_WIDTH, PLOT_TILES, isSlotFree, nearestPlot, plotToWorld, tileToIso } from "./world";
import { spaceTiles, exteriorFaces, isoToTile } from './world';

describe("world grid", () => {
  const quadrants = [{ plotX: 0, plotY: 0 }, { plotX: 1, plotY: 0 }, { plotX: 0, plotY: 1 }, { plotX: 1, plotY: 1 }];
  it('forms exactly 100 unique cells, 25 per owner, with no internal side faces', () => {
    const tiles = spaceTiles(quadrants);
    expect(tiles).toHaveLength(100);
    expect(new Set(tiles.map(t => `${t.tileX},${t.tileY}`)).size).toBe(100);
    quadrants.forEach(space => expect(tiles.filter(t => t.space === space)).toHaveLength(25));
    const faces = exteriorFaces(quadrants);
    expect(faces).toHaveLength(20);
    expect(faces.every(f => f.axis === 'x' ? f.tileX === 9 : f.tileY === 9)).toBe(true);
  });
  it('exposes a newly uncovered edge after arrangement', () => {
    const faces = exteriorFaces(quadrants.slice(0, 3));
    expect(faces.some(f => f.axis === 'x' && f.tileX === 4 && f.tileY === 5)).toBe(true);
  });
  it('round trips fractional and negative grid positions for future movement', () => {
    const tile = { tileX: -2.5, tileY: 7.25 };
    const screen = tileToIso(tile);
    expect(isoToTile(screen.x, screen.y)).toEqual(tile);
  });
  it("projects grid coordinates onto the shared isometric plane", () => {
    expect(tileToIso({ tileX: 1, tileY: 0 })).toEqual({ x: ISO_TILE_WIDTH / 2, y: ISO_TILE_HEIGHT / 2 });
    expect(tileToIso({ tileX: 0, tileY: 1 })).toEqual({ x: -ISO_TILE_WIDTH / 2, y: ISO_TILE_HEIGHT / 2 });
  });

  it("maps plot coordinates edge-to-edge in five-tile increments", () => {
    expect(plotToWorld({ plotX: 1, plotY: 0 })).toEqual({ x: 180, y: 90 });
    expect(plotToWorld({ plotX: 0, plotY: 1 })).toEqual({ x: -180, y: 90 });
  });

  it("inverts screen-space dragging and snaps to whole plot coordinates", () => {
    const onePlotRight = plotToWorld({ plotX: 1, plotY: 0 });
    expect(nearestPlot(onePlotRight.x, onePlotRight.y, { plotX: 0, plotY: 0 })).toEqual({ plotX: 1, plotY: 0 });
  });

  it("rejects occupied slots and ignores the moving plot", () => {
    const positions = [{ plotX: 0, plotY: 0 }, { plotX: 1, plotY: 0 }];
    expect(isSlotFree({ plotX: 0, plotY: 0 }, positions, 1)).toBe(false);
    expect(isSlotFree({ plotX: 1, plotY: 0 }, positions, 1)).toBe(true);
    expect(isSlotFree({ plotX: 2, plotY: 0 }, positions, 1)).toBe(true);
  });

  it.each([1, 5, 10, 25])("keeps %i sequential plots on exact five-tile boundaries", (count) => {
    const plots = Array.from({ length: count }, (_, index) => ({ plotX: index % 5, plotY: Math.floor(index / 5) }));
    const gridPoints = plots.map(({ plotX, plotY }) => ({ tileX: plotX * PLOT_TILES, tileY: plotY * PLOT_TILES }));
    expect(gridPoints.every(({ tileX, tileY }) => tileX % PLOT_TILES === 0 && tileY % PLOT_TILES === 0)).toBe(true);
    expect(new Set(plots.map((plot) => `${plot.plotX},${plot.plotY}`)).size).toBe(count);
  });
});
