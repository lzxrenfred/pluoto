import { expect, it } from 'vitest';
import { spaceAnchor, dragToSpace, CAMERA_OFFSET } from './render3d';
it('maps tile placements and drag deltas without changing product coordinates',()=>{
  expect(spaceAnchor({plotX:1,plotY:1},{tileX:3,tileY:2})).toEqual([8.5,0,7.5]);
  expect(dragToSpace({plotX:1,plotY:0},-5,5)).toEqual({plotX:0,plotY:1});
});
it('preserves the approved two-to-one diamond camera elevation',()=>{
  const elevation=Math.atan2(CAMERA_OFFSET[1],Math.hypot(CAMERA_OFFSET[0],CAMERA_OFFSET[2]));
  expect(Math.sin(elevation)).toBeCloseTo(.5);
});
