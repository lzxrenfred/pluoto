import { Box3, BufferAttribute, BufferGeometry, Color, Matrix3, Matrix4, Vector3, type Material, type Mesh, type Object3D } from "three";

/** One light rig for the world. Baked land colors and the live-lit characters both read it, so they match. */
export const LIGHTS = {
  ambient: { color: "#ffffff", intensity: .28 },
  hemisphere: { sky: "#fff8e9", ground: "#aab99e", intensity: 1.5 },
  sun: { color: "#fff0d7", intensity: 2.7, position: [-6, 14, 9] as [number, number, number] },
};

const sun = new Vector3(...LIGHTS.sun.position).normalize();
const ambient = new Color(LIGHTS.ambient.color).multiplyScalar(LIGHTS.ambient.intensity);
const sky = new Color(LIGHTS.hemisphere.sky).multiplyScalar(LIGHTS.hemisphere.intensity);
const groundLight = new Color(LIGHTS.hemisphere.ground).multiplyScalar(LIGHTS.hemisphere.intensity);
const sunLight = new Color(LIGHTS.sun.color).multiplyScalar(LIGHTS.sun.intensity);
const white = new Color(1, 1, 1);
const roundGeometries = new Set(["SphereGeometry", "DodecahedronGeometry", "IcosahedronGeometry"]);

type Occluder = { owner: Object3D; toLocal: Matrix4; toLocalDirection: Matrix3; center: Vector3; radius: number; round: boolean; geometry: BufferGeometry };
type Source = { mesh: Mesh; owner: Object3D; world: Matrix4; relative: Matrix4; material: Material & { color?: Color; flatShading?: boolean; map?: unknown }; swayNode?: Object3D };

/** World matrix from local transforms, so baking works before the hidden subtree has ever been rendered. */
function worldMatrix(object: Object3D) {
  const chain: Object3D[] = [];
  for (let node: Object3D | null = object; node; node = node.parent) chain.unshift(node);
  const matrix = new Matrix4();
  for (const node of chain) { node.updateMatrix(); matrix.multiply(node.matrix); }
  return matrix;
}

/** Same Lambert sum three.js uses (ambient + hemisphere + sun, divided by π), so baked and live-lit surfaces agree. */
function radiance(albedo: Color, normal: Vector3, sunVisible: number, out: Color) {
  const skyWeight = .5 * normal.y + .5;
  const direct = Math.max(0, normal.dot(sun)) * sunVisible;
  const channel = (key: "r" | "g" | "b") =>
    albedo[key] * (ambient[key] + groundLight[key] + (sky[key] - groundLight[key]) * skyWeight + sunLight[key] * direct) / Math.PI;
  return out.setRGB(channel("r"), channel("g"), channel("b"));
}

const origin = new Vector3(), direction = new Vector3(), offset = new Vector3();
function hitsBox(box: { min: Vector3; max: Vector3 }) {
  let near = -Infinity, far = Infinity;
  for (const axis of ["x", "y", "z"] as const) {
    if (Math.abs(direction[axis]) < 1e-9) {
      if (origin[axis] < box.min[axis] || origin[axis] > box.max[axis]) return false;
      continue;
    }
    let t1 = (box.min[axis] - origin[axis]) / direction[axis], t2 = (box.max[axis] - origin[axis]) / direction[axis];
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1); far = Math.min(far, t2);
    if (near > far) return false;
  }
  return far > 1e-4;
}
function hitsSphere(center: Vector3, radius: number) {
  offset.subVectors(origin, center);
  const b = offset.dot(direction), c = offset.lengthSq() - radius * radius;
  return c <= 0 || (b < 0 && b * b - direction.lengthSq() * c >= 0);
}

/** True when anything except `skip` sits between `point` and the sun along `toSun` (all in the bake root's space). */
function blocked(point: Vector3, toSun: Vector3, occluders: Occluder[], skip?: Object3D) {
  for (const occluder of occluders) {
    if (occluder.owner === skip) continue;
    offset.subVectors(occluder.center, point);
    const along = offset.dot(toSun);
    if (along < -occluder.radius || offset.lengthSq() - along * along > occluder.radius * occluder.radius) continue;
    origin.copy(point).applyMatrix4(occluder.toLocal);
    direction.copy(toSun).applyMatrix3(occluder.toLocalDirection);
    const { boundingBox, boundingSphere } = occluder.geometry;
    if (occluder.round ? hitsSphere(boundingSphere!.center, boundingSphere!.radius) : hitsBox(boundingBox!)) return true;
  }
  return false;
}

/**
 * Merges every mesh under `root` into one geometry in root space.
 * lit: colors become final baked radiance for an unlit material; otherwise albedo + normals for a live-lit one.
 * shadows: castShadow meshes shade receivers. Meshes tagged userData.shadowGrid get per-vertex soft shadows,
 * other receivers one value per mesh, ignoring their own object.
 * Meshes under a node tagged userData.sway = { amplitude, phase } also get a `sway` attribute: the lean (xy) of a
 * rotation about z through the bottom centre of that node's bounds, scaled by amplitude, and the phase (z).
 * ponytail: brute-force ray tests against bounding shapes; fine for a few hundred meshes, use a BVH beyond that.
 */
export function bakeObject(root: Object3D, { lit, shadows = false }: { lit: boolean; shadows?: boolean }) {
  const rootWorld = worldMatrix(root);
  const rootInverse = rootWorld.clone().invert();
  const sources: Source[] = [];
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || mesh.userData.noBake) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Source["material"];
    if (material.map) return;
    let owner: Object3D = mesh;
    while (owner.parent && owner.parent !== root) owner = owner.parent;
    let swayNode: Object3D | null = mesh;
    while (swayNode && swayNode !== root && !swayNode.userData.sway) swayNode = swayNode.parent;
    const world = worldMatrix(mesh);
    sources.push({ mesh, owner, world, relative: rootInverse.clone().multiply(world), material, swayNode: swayNode?.userData.sway ? swayNode : undefined });
  });
  const swayBounds = new Map<Object3D, Box3>();
  for (const { mesh, relative, swayNode } of sources) if (swayNode) {
    mesh.geometry.computeBoundingBox();
    if (!swayBounds.has(swayNode)) swayBounds.set(swayNode, new Box3());
    swayBounds.get(swayNode)!.union(mesh.geometry.boundingBox!.clone().applyMatrix4(relative));
  }

  const occluders: Occluder[] = !shadows ? [] : sources.filter(({ mesh }) => mesh.castShadow).map(({ mesh, owner, relative }) => {
    const geometry = mesh.geometry;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const toLocal = relative.clone().invert();
    return {
      owner, toLocal, geometry, toLocalDirection: new Matrix3().setFromMatrix4(toLocal),
      center: geometry.boundingSphere!.center.clone().applyMatrix4(relative),
      radius: geometry.boundingSphere!.radius * relative.getMaxScaleOnAxis(),
      round: roundGeometries.has(geometry.type),
    };
  });
  const toSun = sun.clone().transformDirection(rootInverse);
  const across = new Vector3(0, 1, 0).cross(toSun).normalize(), up = across.clone().cross(toSun).normalize();
  // Five directions around the sun give baked shadows a soft edge.
  const samples = [[0, 0], [.06, 0], [-.06, 0], [0, .06], [0, -.06]].map(([a, b]) => toSun.clone().addScaledVector(across, a).addScaledVector(up, b).normalize());
  const sunVisibility = (point: Vector3, skip?: Object3D) => samples.filter((sample) => !blocked(point, sample, occluders, skip)).length / samples.length;

  const vertexCount = sources.reduce((total, { mesh }) => total + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count), 0);
  const positions = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3), normals = lit ? null : new Float32Array(vertexCount * 3);
  const sways = swayBounds.size ? new Float32Array(vertexCount * 3) : null;
  const corners = [new Vector3(), new Vector3(), new Vector3()], faceNormal = new Vector3(), edge = new Vector3();
  const worldNormal = new Vector3(), localNormal = new Vector3(), color = new Color();
  let cursor = 0;

  for (const { mesh, owner, world, relative, material, swayNode } of sources) {
    const geometry = mesh.geometry;
    const index = geometry.index, position = geometry.attributes.position, normal = geometry.attributes.normal;
    const count = index?.count ?? position.count;
    const vertex = (k: number) => index ? index.getX(k) : k;
    const flat = Boolean(material.flatShading) || !normal;
    const toRoot = new Matrix3().getNormalMatrix(relative), toWorld = new Matrix3().getNormalMatrix(world);
    const albedo = material.color ?? white;
    const perVertexShadow = shadows && mesh.receiveShadow && mesh.userData.shadowGrid;
    const shadowCache = new Map<string, number>();
    const bounds = swayNode && swayBounds.get(swayNode);
    const { amplitude = 0, phase = 0 } = swayNode?.userData.sway ?? {};
    let meshSun = 1;
    if (shadows && mesh.receiveShadow && !perVertexShadow) {
      geometry.computeBoundingSphere();
      meshSun = sunVisibility(geometry.boundingSphere!.center.clone().applyMatrix4(relative), owner);
    }
    for (let k = 0; k < count; k += 3) {
      for (let corner = 0; corner < 3; corner++) corners[corner].fromBufferAttribute(position, vertex(k + corner)).applyMatrix4(relative);
      if (flat) faceNormal.subVectors(corners[1], corners[0]).cross(edge.subVectors(corners[2], corners[0])).normalize();
      for (let corner = 0; corner < 3; corner++) {
        const point = corners[corner];
        if (flat) { localNormal.copy(faceNormal); worldNormal.copy(faceNormal).transformDirection(rootWorld); }
        else {
          localNormal.fromBufferAttribute(normal, vertex(k + corner)).applyMatrix3(toRoot).normalize();
          worldNormal.fromBufferAttribute(normal, vertex(k + corner)).applyMatrix3(toWorld).normalize();
        }
        let sunVisible = meshSun;
        if (perVertexShadow) {
          const key = `${point.x.toFixed(3)},${point.z.toFixed(3)}`;
          sunVisible = shadowCache.get(key) ?? sunVisibility(point, owner);
          shadowCache.set(key, sunVisible);
        }
        if (lit) radiance(albedo, worldNormal, sunVisible, color); else color.copy(albedo);
        point.toArray(positions, cursor * 3);
        color.toArray(colors, cursor * 3);
        if (normals) localNormal.toArray(normals, cursor * 3);
        if (sways && bounds) {
          sways[cursor * 3] = -(point.y - bounds.min.y) * amplitude;
          sways[cursor * 3 + 1] = (point.x - (bounds.min.x + bounds.max.x) / 2) * amplitude;
          sways[cursor * 3 + 2] = phase;
        }
        cursor++;
      }
    }
  }

  const baked = new BufferGeometry();
  baked.setAttribute("position", new BufferAttribute(positions, 3));
  baked.setAttribute("color", new BufferAttribute(colors, 3));
  if (normals) baked.setAttribute("normal", new BufferAttribute(normals, 3));
  if (sways) baked.setAttribute("sway", new BufferAttribute(sways, 3));
  baked.computeBoundingSphere();
  return baked;
}
