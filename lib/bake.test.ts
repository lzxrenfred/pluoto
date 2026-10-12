import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from "three";
import { expect, it } from "vitest";
import { bakeObject } from "./bake";

it("merges every mesh into one geometry in the root's space", () => {
  const root = new Group();
  const moved = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
  moved.position.set(2, 0, 0);
  root.add(moved, new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
  const geometry = bakeObject(root, { lit: false });
  geometry.computeBoundingBox();
  expect(geometry.attributes.position.count).toBe(72);
  expect(geometry.attributes.normal.count).toBe(72);
  expect(geometry.boundingBox!.max.x).toBeCloseTo(2.5);
});

it("gives tagged meshes a lean that grows with height above their base, and leaves the rest still", () => {
  const root = new Group();
  const tree = new Group();
  tree.userData.sway = { amplitude: .01, phase: 1.5 };
  const trunk = new Mesh(new BoxGeometry(.2, 2, .2), new MeshStandardMaterial());
  trunk.position.set(3, 1, 0);
  tree.add(trunk);
  root.add(tree, new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
  const sway = bakeObject(root, { lit: true }).attributes.sway;
  const trunkArms = Array.from({ length: 36 }, (_, i) => sway.getX(i));
  expect(Math.min(...trunkArms)).toBeCloseTo(-.02); // top of a 2-unit trunk: -height × amplitude
  expect(Math.max(...trunkArms)).toBeCloseTo(0); // its base stays put
  expect(sway.getZ(0)).toBe(1.5);
  expect(Array.from({ length: 36 }, (_, i) => [sway.getX(36 + i), sway.getY(36 + i), sway.getZ(36 + i)]).flat().every((value) => value === 0)).toBe(true);
});

it("bakes a soft sun shadow onto the ground behind an occluder", () => {
  const root = new Group();
  const ground = new Mesh(new PlaneGeometry(10, 10, 20, 20), new MeshStandardMaterial());
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.shadowGrid = true;
  const block = new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial());
  block.position.y = 1;
  block.castShadow = true;
  root.add(ground, block);
  const geometry = bakeObject(root, { lit: true, shadows: true });
  const position = geometry.attributes.position, color = geometry.attributes.color, point = new Vector3();
  const brightnessAt = (x: number, z: number) => {
    for (let i = 0; i < position.count; i++) if (point.fromBufferAttribute(position, i).distanceTo(new Vector3(x, 0, z)) < 1e-3) return color.getX(i);
    throw new Error(`no ground vertex at ${x},${z}`);
  };
  // The sun sits up and to the left-front (-x, +z), so the shadow falls toward +x, -z.
  expect(brightnessAt(1, -1)).toBeLessThan(brightnessAt(-3, 3) * .7);
});
