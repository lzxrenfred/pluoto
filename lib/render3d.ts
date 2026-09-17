import { ISO_HALF_WIDTH, LAND_DEPTH, PLOT_TILES, plotToGrid, type PlotPosition, type TilePosition } from './world';

/** Rendering adapter: one logical tile = one scene unit. Product state never stores XYZ. */
export function gridToScene(tile: TilePosition, height = 0): [number, number, number] {
  return [tile.tileX, height, tile.tileY];
}
export function spaceAnchor(space: PlotPosition, local: TilePosition, footprint = 1): [number, number, number] {
  const origin = plotToGrid(space);
  return gridToScene({tileX:origin.tileX+local.tileX+footprint/2, tileY:origin.tileY+local.tileY+footprint/2});
}
export function dragToSpace(start: PlotPosition, dx: number, dz: number): PlotPosition {
  return {plotX:start.plotX+Math.round(dx/PLOT_TILES), plotY:start.plotY+Math.round(dz/PLOT_TILES)};
}
// A 45° azimuth and 30° elevation exactly reproduce the approved 2:1 diamonds.
export const CAMERA_OFFSET: [number,number,number] = [12, Math.sqrt(288)*Math.tan(Math.PI/6), 12];
export const TERRAIN_DEPTH = LAND_DEPTH / (ISO_HALF_WIDTH*Math.sqrt(2)*Math.cos(Math.PI/6));
