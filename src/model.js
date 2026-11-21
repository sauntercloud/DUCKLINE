import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

let seed = 81734;
export function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const cache = new Map();
export function mat(color, metalness = 0, roughness = 0.72) {
  const key = [color, metalness, roughness].join("/");
  if (!cache.has(key))
    cache.set(key, new T.MeshStandardMaterial({ color, metalness, roughness }));
  return cache.get(key);
}
export function group(parent, x = 0, y = 0, z = 0) {
  const g = new T.Group();
  parent.add(g);
  g.position.set(x, y, z);
  return g;
}
export function mesh(parent, geo, material, x, y, z) {
  const m = new T.Mesh(geo, material.isMaterial ? material : mat(material));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const cube = new T.BoxGeometry(1, 1, 1),
  ball = new T.SphereGeometry(1, 24, 16);
export function box(p, x, y, z, w, h, d, m) {
  const o = mesh(p, cube, m, x, y, z);
  o.scale.set(w, h, d);
  return o;
}
export function oval(p, x, y, z, w, h, d, m) {
  const o = mesh(p, ball, m, x, y, z);
  o.scale.set(w, h, d);
  return o;
}
export function cylinder(p, x, y, z, rt, rb, h, m, s = 16) {
  return mesh(p, new T.CylinderGeometry(rt, rb, h, s), m, x, y, z);
}
export function beam(p, a, b, r, m) {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    v = end.clone().sub(start);
  const center = start.addScaledVector(v, 0.5);
  const o = cylinder(p, center.x, center.y, center.z, r, r, v.length(), m, 8);
  o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
  return o;
}
export function canvasTex(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// Merge identical materials into static batches while preserving world transforms.
export function batch(root) {
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert(),
    batches = new Map(),
    old = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const geo = o.geometry.index
      ? o.geometry.toNonIndexed()
      : o.geometry.clone();
    geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = o.material.uuid + o.castShadow + o.receiveShadow;
    if (!batches.has(key))
      batches.set(key, {
        geos: [],
        m: o.material,
        cast: o.castShadow,
        receive: o.receiveShadow,
      });
    batches.get(key).geos.push(geo);
    old.push(o);
  });
  old.forEach((o) => o.removeFromParent());
  for (const b of batches.values()) {
    const merged = mergeGeometries(b.geos),
      o = new T.Mesh(merged, b.m);
    o.castShadow = b.cast;
    o.receiveShadow = b.receive;
    root.add(o);
    b.geos.forEach((g) => g.dispose());
  }
}
const ink = mat(0x242a28, 0.52, 0.45),
  edge = mat(0x454946, 0.55, 0.43),
  olive = mat(0x555843),
  strap = mat(0x343d36);
function rifle(p, fixedMagazine) {
  const g = group(p);
  box(g, 0, 0, 0, 0.13, 0.19, 0.55, ink);
  box(g, 0, 0.115, 0.02, 0.11, 0.045, 0.57, edge);
  box(g, 0, -0.02, -0.35, 0.12, 0.125, 0.23, olive);
  box(g, 0, -0.035, -0.49, 0.16, 0.215, 0.085, olive);
  box(g, 0, -0.16, -0.08, 0.08, 0.2, 0.1, ink).rotation.x = -0.26;
  if (fixedMagazine)
    box(g, 0, -0.19, 0.12, 0.11, 0.25, 0.13, edge).rotation.x = -0.17;
  box(g, 0, 0.025, 0.36, 0.14, 0.14, 0.36, olive);
  for (let i = 0; i < 5; i++)
    box(g, 0, 0.02, 0.23 + i * 0.06, 0.151, 0.094, 0.023, ink);
  const barrel = cylinder(g, 0, 0.045, 0.6, 0.029, 0.03, 0.37, ink);
  barrel.rotation.x = Math.PI / 2;
  box(g, 0, 0.18, -0.07, 0.088, 0.11, 0.105, ink);
  box(g, 0, 0.15, 0.49, 0.034, 0.13, 0.034, edge);
  return g;
}
function magazinePair(weapon, small) {
  const seated = group(weapon);
  const width = small ? 0.083 : 0.124,
    depth = small ? 0.125 : 0.16,
    length = small ? 0.2 : 0.31;
  box(seated, 0, 0, 0, width, length, depth, edge);
  box(seated, 0, -length / 2, 0, width + 0.024, 0.044, depth + 0.022, olive);
  box(
    seated,
    0,
    -length * 0.17,
    0,
    width + 0.007,
    0.045,
    depth + 0.007,
    mat(0xb39963, 0.32),
  );
  batch(seated);
  const removed = seated.clone();
  weapon.add(removed);
  removed.visible = false;
  seated.position.set(0, small ? -0.16 : -0.21, small ? -0.01 : 0.12);
  seated.rotation.x = small ? 0 : -0.17;
  return {
    seated,
    removed,
    socket: seated.position.clone(),
    tilt: seated.rotation.x,
  };
}
export function duck(host, enemy = false) {
  const root = group(host),
    body = group(root);
  const feather = mat(enemy ? 0xb2a08b : 0xffefcb),
    beak = mat(0xf3a12a),
    helmet = mat(enemy ? 0x5e5145 : 0x57634d, 0.32, 0.51);
  const armor = mat(enemy ? 0x624437 : 0x4d5848);
  const torso = oval(body, 0, 0.85, 0.02, 0.44, 0.54, 0.41, feather);
  oval(body, 0, 0.82, -0.33, 0.29, 0.23, 0.34, feather).rotation.x = -0.37;
  oval(body, 0, 0.87, 0.03, 0.465, 0.42, 0.432, armor);
  for (const x of [-0.24, 0.24])
    box(body, x, 1.05, 0.316, 0.092, 0.45, 0.095, strap).rotation.z = x * 0.54;
  box(body, 0, 0.77, 0.429, 0.49, 0.12, 0.08, strap);
  for (const x of [-0.17, 0, 0.17]) {
    box(body, x, 0.87, 0.448, 0.145, 0.24, 0.092, olive);
    box(body, x, 0.944, 0.502, 0.14, 0.058, 0.032, strap);
  }
  box(body, 0, 0.94, -0.42, 0.59, 0.64, 0.3, olive);
  box(body, 0, 0.85, -0.59, 0.47, 0.31, 0.1, strap);
  for (const x of [-0.18, 0.18])
    box(body, x, 0.94, -0.589, 0.05, 0.59, 0.043, ink);
  const head = group(body, 0, 1.27, 0.06);
  const face = group(head, 0, -1.27, -0.06);
  oval(face, 0, 1.54, 0.07, 0.515, 0.48, 0.47, feather);
  oval(face, 0, 1.42, 0.518, 0.3, 0.095, 0.285, beak);
  oval(face, 0, 1.374, 0.54, 0.27, 0.055, 0.234, mat(0xd37a24));
  for (const s of [-1, 1]) {
    oval(
      face,
      s * 0.348,
      1.6,
      0.383,
      0.065,
      0.083,
      0.054,
      mat(0x151b19, 0.1, 0.22),
    );
    oval(face, s * 0.36, 1.63, 0.424, 0.015, 0.017, 0.018, 0xf6f0da);
    oval(face, s * 0.115, 1.49, 0.616, 0.021, 0.009, 0.027, 0x915f26);
  }
  mesh(
    face,
    new T.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    helmet,
    0,
    1.7,
    0.05,
  ).scale.set(0.56, 0.39, 0.515);
  oval(face, 0, 1.686, 0.06, 0.568, 0.07, 0.528, strap);
  box(face, 0, 1.827, 0.518, 0.16, 0.13, 0.048, ink);
  box(face, 0, 1.84, 0.548, 0.082, 0.075, 0.027, olive);
  for (const s of [-1, 1]) {
    oval(face, s * 0.475, 1.6, 0.012, 0.09, 0.16, 0.135, strap);
    box(face, s * 0.48, 1.47, 0.078, 0.043, 0.21, 0.05, olive).rotation.x =
      -0.26;
  }
  box(
    face,
    0.515,
    1.77,
    0.06,
    0.032,
    0.073,
    0.16,
    mat(enemy ? 0xbc6446 : 0xfaac51),
  );
  const wings = [-1, 1].map((s) => {
    const shoulder = group(body, s * 0.36, 1.14, 0.12);
    const wing = group(shoulder, -s * 0.36, -1.14, -0.12);
    oval(wing, s * 0.393, 1.007, 0.17, 0.183, 0.3, 0.23, armor).rotation.x =
      -0.66;
    oval(wing, s * 0.377, 0.96, 0.37, 0.14, 0.19, 0.16, feather);
    return shoulder;
  });
  const gun = rifle(body, enemy);
  gun.position.set(0.355, 0.95, 0.58);
  gun.rotation.x = 0.045;
  gun.scale.setScalar(1.04);
  const legs = [-1, 1].map((s) => {
    const g = group(root, s * 0.19, 0.38, 0.045);
    cylinder(g, 0, -0.095, 0, 0.056, 0.052, 0.23, beak);
    oval(g, 0, -0.251, 0.068, 0.149, 0.064, 0.206, beak);
    for (const v of [-1, 0, 1])
      oval(g, v * 0.073, -0.26, 0.177, 0.065, 0.045, 0.121, beak).rotation.y =
        v * 0.18;
    batch(g);
    return g;
  });
  gun.removeFromParent();
  batch(gun);
  for (const part of [head, ...wings]) {
    part.removeFromParent();
    batch(part);
  }
  batch(body);
  body.add(head, ...wings, gun);
  const pistol = group(body, 0.355, 0.95, 0.63);
  box(pistol, 0, 0, 0.11, 0.13, 0.14, 0.42, edge);
  box(pistol, 0, -0.12, -0.01, 0.1, 0.19, 0.14, ink);
  batch(pistol);
  pistol.visible = false;
  root.rotation.y = 1.04;
  return {
    root,
    body,
    head,
    wings,
    legs,
    gun,
    pistol,
    magazines: enemy
      ? null
      : [magazinePair(gun, false), magazinePair(pistol, true)],
    motion: {
      phase: 0,
      speed: 0,
      heading: root.rotation.y,
      forward: 1,
      side: 0,
      twist: 0,
      search: 0,
      extract: 0,
    },
  };
}
