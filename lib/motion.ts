"use client";

import { useEffect, useRef, useState } from 'react';
import { PLOT_TILES, type TilePosition } from './world';

export const MOTION = { stepMs: 1800, restMs: 5500, focusMs: 850, bubbleMs: 240 };
export const WANDER_DELAY = { initialMin: 1.2, initialMax: 4.2, restMin: 2.8, restMax: 7.2 };
export function randomWanderDelay(initial = false, random = Math.random) {
  const min = initial ? WANDER_DELAY.initialMin : WANDER_DELAY.restMin;
  const max = initial ? WANDER_DELAY.initialMax : WANDER_DELAY.restMax;
  return min + (max - min) * random();
}
export const calmEase = (t: number) => t * t * (3 - 2 * t);
export function walkableNeighbors(position: TilePosition, blocked: TilePosition[]) {
  return [[1,0],[0,1],[-1,0],[0,-1]].map(([x,y]) => ({ tileX: position.tileX+x, tileY: position.tileY+y }))
    .filter(p => p.tileX >= 0 && p.tileY >= 0 && p.tileX < PLOT_TILES && p.tileY < PLOT_TILES && !blocked.some(b => b.tileX === p.tileX && b.tileY === p.tileY));
}

export function useMotionAllowed() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAllowed(!query.matches && !document.hidden);
    update(); query.addEventListener('change', update); document.addEventListener('visibilitychange', update);
    return () => { query.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  return allowed;
}

/** Motion emits logical coordinates + heading; a future 3D rig can consume the same pose. */
export function useGridMotion(start: TilePosition, blocked: TilePosition[], enabled: boolean, delay: number) {
  const allowed = useMotionAllowed();
  const poseRef = useRef({ ...start, headingX: 1, headingY: 0, moving: false, lift: 0 });
  const [pose, setPose] = useState(poseRef.current);
  const key = `${start.tileX},${start.tileY}`;
  const blockedKey = JSON.stringify(blocked);
  useEffect(() => {
    poseRef.current = { ...start, headingX: 1, headingY: 0, moving: false, lift: 0 };
    setPose(poseRef.current);
  }, [key]); // Scene changes establish a new spawn cell.
  useEffect(() => {
    if (!allowed || !enabled) {
      poseRef.current = { ...poseRef.current, moving: false, lift: 0 };
      setPose(poseRef.current);
      return;
    }
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    let turn = 0;
    const step = () => {
      const from = { ...poseRef.current };
      // Resume an interrupted edge before choosing another neighboring cell.
      const rounded = { tileX: Math.round(from.tileX), tileY: Math.round(from.tileY) };
      const choices = walkableNeighbors(rounded, JSON.parse(blockedKey));
      const target = from.tileX !== rounded.tileX || from.tileY !== rounded.tileY ? rounded : choices[turn++ % choices.length];
      if (!target) return;
      const began = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - began) / MOTION.stepMs);
        const eased = calmEase(t);
        const next = { tileX: from.tileX + (target.tileX-from.tileX)*eased, tileY: from.tileY + (target.tileY-from.tileY)*eased,
          headingX: target.tileX-from.tileX, headingY: target.tileY-from.tileY, moving: t < 1, lift: Math.sin(t*Math.PI*4)**2 * 1.5 };
        poseRef.current = next; setPose(next);
        if (t < 1) frame = requestAnimationFrame(tick);
        else timer = setTimeout(step, MOTION.restMs + delay);
      };
      frame = requestAnimationFrame(tick);
    };
    timer = setTimeout(step, delay + 3000);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [allowed, enabled, key, blockedKey, delay]);
  return pose;
}
