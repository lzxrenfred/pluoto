export const PLOT_TILES = 5;
export const ISO_TILE_WIDTH = 72;
export const ISO_TILE_HEIGHT = 36;
export const ISO_HALF_WIDTH = ISO_TILE_WIDTH / 2;
export const ISO_HALF_HEIGHT = ISO_TILE_HEIGHT / 2;
export const LAND_DEPTH = 36;

export const WORLD_STAGE_WIDTH = 920;
export const WORLD_STAGE_HEIGHT = 610;
export const WORLD_ORIGIN_X = WORLD_STAGE_WIDTH / 2;
export const WORLD_ORIGIN_Y = 92;

export type PlotPosition = { plotX: number; plotY: number };
export type TilePosition = { tileX: number; tileY: number };

export function isoToTile(x: number, y: number): TilePosition {
  return { tileX: x / ISO_TILE_WIDTH + y / ISO_TILE_HEIGHT, tileY: y / ISO_TILE_HEIGHT - x / ISO_TILE_WIDTH };
}

export function spaceTiles<T extends PlotPosition>(spaces: T[]) {
  const seen = new Set<string>();
  return spaces.flatMap((space) => Array.from({ length: PLOT_TILES ** 2 }, (_, index) => {
    const tileX = space.plotX * PLOT_TILES + index % PLOT_TILES;
    const tileY = space.plotY * PLOT_TILES + Math.floor(index / PLOT_TILES);
    const key = `${tileX},${tileY}`;
    if (seen.has(key)) throw new Error(`Overlapping Space at ${key}`);
    seen.add(key);
    return { tileX, tileY, space };
  }));
}

/** Visible vertical faces exist only where the adjacent world cell is absent. */
export function exteriorFaces<T extends PlotPosition>(spaces: T[]) {
  const tiles = spaceTiles(spaces);
  const occupied = new Set(tiles.map(({ tileX, tileY }) => `${tileX},${tileY}`));
  return tiles.flatMap((tile) => (['x', 'y'] as const)
    .filter((axis) => !occupied.has(`${tile.tileX + (axis === 'x' ? 1 : 0)},${tile.tileY + (axis === 'y' ? 1 : 0)}`))
    .map((axis) => ({ ...tile, axis })));
}

export function depthOrder(x: number, y: number) {
  return 1000 + Math.round((x + y) * 100);
}

export function tileToIso(position: TilePosition, elevation = 0) {
  return {
    x: (position.tileX - position.tileY) * ISO_HALF_WIDTH,
    y: (position.tileX + position.tileY) * ISO_HALF_HEIGHT - elevation,
  };
}

export function plotToGrid(position: PlotPosition): TilePosition {
  return {
    tileX: position.plotX * PLOT_TILES,
    tileY: position.plotY * PLOT_TILES,
  };
}

export function plotToWorld(position: PlotPosition) {
  return tileToIso(plotToGrid(position));
}

export function positionKey(position: PlotPosition) {
  return `${position.plotX},${position.plotY}`;
}

export function nearestPlot(deltaX: number, deltaY: number, start: PlotPosition): PlotPosition {
  const { tileX: tileDeltaX, tileY: tileDeltaY } = isoToTile(deltaX, deltaY);
  return {
    plotX: start.plotX + Math.round(tileDeltaX / PLOT_TILES),
    plotY: start.plotY + Math.round(tileDeltaY / PLOT_TILES),
  };
}

export function isSlotFree(target: PlotPosition, positions: PlotPosition[], movingIndex = -1) {
  return !positions.some((position, index) => index !== movingIndex && positionKey(position) === positionKey(target));
}
