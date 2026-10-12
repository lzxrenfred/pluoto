"use client";

import { useLayoutEffect, useReducer, useRef, type ReactNode } from "react";
import type { ThreeElements } from "@react-three/fiber";
import { MeshBasicMaterial, MeshLambertMaterial, type BufferGeometry, type Group } from "three";
import { bakeObject } from "@/lib/bake";

// ponytail: baked geometry lives for the session and is never evicted; add ref-counting if edited lands pile up.
const cache = new Map<string, BufferGeometry>();
export const bakedMaterial = new MeshBasicMaterial({ vertexColors: true });
export const litVertexMaterial = new MeshLambertMaterial({ vertexColors: true });
/** Canopy sway clock in seconds. The world advances it only while motion is on, so sway pauses instead of jumping. */
export const swayTime = { value: 0 };
/** bakedMaterial for geometry with a baked `sway` attribute: each vertex leans by its arm (xy) at its phase (z). */
export const swayingMaterial = new MeshBasicMaterial({ vertexColors: true });
swayingMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.swayTime = swayTime;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute vec3 sway;\nuniform float swayTime;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.xy += sway.xy * sin(swayTime * 0.34 + sway.z);");
};
export const noRaycast = () => undefined;
const logBakes = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf");

type Props = Omit<ThreeElements["mesh"], "children" | "geometry"> & { cacheKey: string; lit?: boolean; shadows?: boolean; children: ReactNode };

/**
 * Mounts its children once, hidden, merges them into a single mesh and reuses that geometry for every
 * later mount with the same key. lit: lighting is baked into vertex colors (unlit material); otherwise
 * the mesh keeps normals and is lit live (for things that turn, like characters).
 */
export function Baked({ cacheKey, lit = true, shadows = false, children, material, ...mesh }: Props) {
  const source = useRef<Group>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const geometry = cache.get(cacheKey);
  useLayoutEffect(() => {
    if (geometry || !source.current) return;
    // Instances mounted in the same commit (four signs, twin lands) share the first one's bake.
    if (!cache.has(cacheKey)) {
      const started = performance.now();
      const baked = bakeObject(source.current, { lit, shadows });
      if (logBakes) console.info(`[bake] ${(performance.now() - started).toFixed(1)}ms · ${baked.attributes.position.count / 3} triangles · ${cacheKey.slice(0, 48)}`);
      cache.set(cacheKey, baked);
    }
    rerender();
  }, [cacheKey, geometry, lit, shadows]);
  if (!geometry) return <group ref={source} visible={false}>{children}</group>;
  return <mesh {...mesh} geometry={geometry} material={material ?? (geometry.attributes.sway ? swayingMaterial : lit ? bakedMaterial : litVertexMaterial)}/>;
}
