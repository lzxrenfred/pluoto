import { describe, expect, it } from "vitest";
import { PLOT_SIZE, isSlotFree, nearestPlot, plotToWorld } from "./world";

describe("world grid", () => {
  it("maps integer plot coordinates edge-to-edge", () => {
    expect(plotToWorld({ plotX: 1, plotY: -2 })).toEqual({ x: PLOT_SIZE, y: -2 * PLOT_SIZE });
  });

  it("snaps to the nearest whole plot coordinate", () => {
    expect(nearestPlot(PLOT_SIZE * 0.6, -PLOT_SIZE * 1.7, { plotX: 0, plotY: 0 })).toEqual({ plotX: 1, plotY: -2 });
  });

  it("rejects occupied slots and ignores the moving plot", () => {
    const positions = [{ plotX: 0, plotY: 0 }, { plotX: 1, plotY: 0 }];
    expect(isSlotFree({ plotX: 0, plotY: 0 }, positions, 1)).toBe(false);
    expect(isSlotFree({ plotX: 1, plotY: 0 }, positions, 1)).toBe(true);
    expect(isSlotFree({ plotX: 2, plotY: 0 }, positions, 1)).toBe(true);
  });

  it.each([1, 5, 10, 25])("keeps %i sequential plots on exact chunk boundaries", (count) => {
    const plots = Array.from({ length: count }, (_, index) => ({ plotX: index % 5, plotY: Math.floor(index / 5) }));
    const worldPoints = plots.map(plotToWorld);
    expect(worldPoints.every(({ x, y }) => x % PLOT_SIZE === 0 && y % PLOT_SIZE === 0)).toBe(true);
    expect(new Set(plots.map((plot) => `${plot.plotX},${plot.plotY}`)).size).toBe(count);
  });
});
