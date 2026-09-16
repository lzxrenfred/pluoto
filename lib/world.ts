export const TILE_SIZE = 64;
export const PLOT_TILES = 5;
export const PLOT_SIZE = TILE_SIZE * PLOT_TILES;

export type PlotPosition = { plotX: number; plotY: number };

export function plotToWorld(position: PlotPosition) {
  return { x: position.plotX * PLOT_SIZE, y: position.plotY * PLOT_SIZE };
}

export function positionKey(position: PlotPosition) {
  return `${position.plotX},${position.plotY}`;
}

export function nearestPlot(deltaX: number, deltaY: number, start: PlotPosition): PlotPosition {
  return {
    plotX: start.plotX + Math.round(deltaX / PLOT_SIZE),
    plotY: start.plotY + Math.round(deltaY / PLOT_SIZE),
  };
}

export function isSlotFree(target: PlotPosition, positions: PlotPosition[], movingIndex = -1) {
  return !positions.some((position, index) => index !== movingIndex && positionKey(position) === positionKey(target));
}
