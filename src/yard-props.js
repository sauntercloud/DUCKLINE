import * as T from "three";
import {
  box,
  beam,
  cylinder,
  group,
  mesh,
  oval,
  mat,
  canvasTex,
  random,
} from "./model.js";
import { heightAt } from "./terrain.js";

const iron = mat(0x41494a, 0.66),
  timber = mat(0x806446),
  canvas = mat(0x69725a),
  seam = mat(0xb7b192),
  rubber = mat(0x252a29),
  red = mat(0xa04f38),
  ochre = mat(0xb99a57);
const cloth = canvas.clone();
cloth.side = T.DoubleSide;
const weave = canvasTex(512, 384, (c, w, h) => {
  c.fillStyle = "#ddd9c8";
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 38000; i++) {
    c.fillStyle =
      random() > 0.48 ? "rgba(51,45,31,.17)" : "rgba(255,246,215,.25)";
    c.fillRect(random() * w, random() * h, 1 + random() * 3, 1);
  }
  for (let i = 0; i < 5; i++) {
    const x = (i * w) / 4;
    c.fillStyle = "rgba(75,69,49,.28)";
    c.fillRect(x, 0, 3, h);
    const fold = c.createLinearGradient(x, 0, x + 24, 0);
    fold.addColorStop(0, "rgba(42,45,31,.22)");
    fold.addColorStop(1, "rgba(71,73,52,0)");
    c.fillStyle = fold;
    c.fillRect(x, 0, 24, h);
  }
});
cloth.map = weave;
const sack = new T.SphereGeometry(1, 16, 10);
const vertices = sack.attributes.position;
for (let i = 0; i < vertices.count; i++) {
  const coords = [vertices.getX(i), vertices.getY(i), vertices.getZ(i)].map(
    (n) => Math.sign(n) * Math.pow(Math.abs(n), 0.53),
  );
  vertices.setXYZ(i, ...coords);
}
sack.computeVertexNormals();
const burlap = [0x897f61, 0x9c8f70].map(
  (color) => new T.MeshStandardMaterial({ color, map: weave, roughness: 1 }),
);
function tent(parent, x, z, collide) {
  const g = group(parent, x, heightAt(x, z), z);
  // Walled canvas shelter with a ridge seam, open doorway and rolled flaps.
  const slope = Math.atan2(1.56, 2.55);
  for (const s of [-1, 1]) {
    box(g, s * 1.275, 2.55, 0, 3.0, 0.055, 6.2, cloth).rotation.z = -s * slope;
    box(g, s * 2.51, 0.9, 0, 0.055, 1.8, 6.1, cloth);
    for (const zz of [-2.8, 0, 2.8]) {
      beam(g, [0, 3.36, zz], [s * 2.55, 1.79, zz], 0.032, seam);
      beam(g, [s * 2.52, 1.77, zz], [s * 3.26, 0.08, zz + 0.24], 0.016, seam);
    }
    box(g, s * 1.7, 0.88, 3.035, 1.65, 1.76, 0.05, cloth);
    box(g, s * 0.95, 1.04, 3.08, 0.18, 1.85, 0.18, seam).rotation.z = s * 0.12;
  }
  box(g, 0, 0.89, -3.04, 5.03, 1.78, 0.06, cloth);
  for (const zz of [-3.035, 3.035]) {
    const geo = new T.BufferGeometry().setFromPoints([
      new T.Vector3(-2.55, 1.75, zz),
      new T.Vector3(2.55, 1.75, zz),
      new T.Vector3(0, 3.34, zz),
    ]);
    geo.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2),
    );
    geo.computeVertexNormals();
    mesh(g, geo, cloth, 0, 0, 0);
  }
  for (const side of [-1, 1]) {
    box(g, side * 1.55, 0.58, 0.2, 1.32, 0.12, 3.6, mat(0x666f5e));
    box(g, side * 1.55, 0.72, -1.1, 1.13, 0.17, 0.6, seam);
    for (const j of [-1.3, 1.35])
      for (const k of [-0.5, 0.5])
        box(g, side * 1.55 + k, 0.29, j, 0.07, 0.52, 0.08, iron);
    collide(x + side * 2.51, z, 0.1, 6.13, "wood", 1.85);
    collide(x + side * 1.7, z + 3.035, 1.65, 0.1, "wood", 1.8);
    collide(x + side * 1.55, z + 0.2, 1.32, 3.6, "wood", 0.7);
  }
  collide(x, z - 3.04, 5.03, 0.1, "wood", 2.3);
}
function placard(g, x, z, text) {
  const p = group(g, x, heightAt(x, z), z);
  for (const i of [-0.88, 0.88]) box(p, i, 1.15, 0, 0.11, 2.3, 0.12, iron);
  box(p, 0, 1.85, 0, 2.45, 0.83, 0.1, mat(0x484c3e));
  const tex = canvasTex(512, 160, (c) => {
    c.fillStyle = "#454d40";
    c.fillRect(0, 0, 512, 160);
    c.strokeStyle = "#c3b68c";
    c.lineWidth = 3;
    c.strokeRect(8, 8, 496, 144);
    c.fillStyle = "#e8deba";
    c.font = "bold 55px sans-serif";
    c.textAlign = "center";
    c.fillText(text, 256, 98);
  });
  mesh(
    p,
    new T.PlaneGeometry(2.4, 0.76),
    new T.MeshStandardMaterial({ map: tex }),
    0,
    1.85,
    0.057,
  );
}
function generator(g, x, z, collide) {
  const p = group(g, x, heightAt(x, z), z);
  box(p, 0, 0.24, 0, 2.1, 0.23, 1.27, iron);
  box(p, 0, 0.88, 0, 1.95, 1, 1.1, ochre);
  for (let i = 0; i < 11; i++)
    box(p, -0.73 + i * 0.135, 0.88, 0.566, 0.052, 0.65, 0.04, iron);
  cylinder(p, 0.57, 1.6, -0.32, 0.085, 0.09, 0.67, iron);
  for (const i of [-0.72, 0.72])
    for (const s of [-1, 1])
      cylinder(p, i, 0.27, s * 0.57, 0.24, 0.24, 0.13, rubber).rotation.x =
        Math.PI / 2;
  collide(x, z, 2.1, 1.3, "metal", 1.48);
}
function reel(g, x, z, collide) {
  const p = group(g, x, heightAt(x, z), z);
  cylinder(p, 0, 0.82, 0, 0.64, 0.64, 1.2, rubber, 24).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    cylinder(p, 0, 0.82, s * 0.67, 0.83, 0.83, 0.12, timber, 24).rotation.x =
      Math.PI / 2;
    cylinder(p, 0, 0.82, s * 0.75, 0.16, 0.16, 0.08, iron).rotation.x =
      Math.PI / 2;
  }
  for (let i = 0; i < 9; i++)
    cylinder(
      p,
      0,
      0.82,
      -0.51 + i * 0.13,
      0.67,
      0.67,
      0.045,
      iron,
      24,
    ).rotation.x = Math.PI / 2;
  collide(x, z, 1.65, 1.5, "wood", 1.65);
}
export function buildCamp(g, collide) {
  tent(g, -7, -51, collide);
  tent(g, 2, -55, collide);
  const x = 7,
    z = -48,
    p = group(g, x, heightAt(x, z), z);
  box(p, 0, 1.08, 0, 3, 0.13, 1.5, timber);
  for (const i of [-1.27, 1.27])
    for (const j of [-0.57, 0.57]) box(p, i, 0.53, j, 0.1, 1, 0.1, iron);
  box(p, -0.45, 1.43, 0, 1.32, 0.57, 0.69, iron);
  box(p, -0.57, 1.48, 0.355, 0.52, 0.19, 0.03, mat(0x82b4a1));
  for (let i = 0; i < 3; i++)
    cylinder(
      p,
      -0.05 + i * 0.13,
      1.39,
      0.36,
      0.047,
      0.047,
      0.045,
      rubber,
    ).rotation.x = Math.PI / 2;
  box(p, 0.94, 1.18, 0.1, 0.62, 0.035, 0.7, seam).rotation.y = 0.15;
  collide(x, z, 3, 1.5, "wood", 1.65);
  const mast = group(g, 10, heightAt(10, -52), -52);
  for (const s of [-1, 1])
    beam(mast, [s * 0.62, 0, 0], [s * 0.12, 8.7, 0], 0.068, iron);
  for (let i = 0; i < 8; i++) {
    let w = 0.58 - i * 0.057;
    beam(mast, [-w, i + 0.4, 0], [w - 0.057, i + 1.4, 0], 0.043, iron);
    beam(mast, [-w, i + 0.4, 0], [w, i + 0.4, 0], 0.038, iron);
  }
  beam(mast, [0, 8.6, 0], [0, 10.2, 0], 0.048, iron);
  for (const y of [8.75, 9.3, 9.82])
    beam(mast, [-1.04, y, 0], [1.04, y, 0], 0.045, iron);
  oval(
    mast,
    0,
    10.25,
    0,
    0.105,
    0.14,
    0.105,
    new T.MeshBasicMaterial({ color: new T.Color(3.5, 0.33, 0.13) }),
  );
  collide(10, -52, 1.35, 0.56, "metal", 8.7);
  for (const x of [-8, 6]) {
    const q = group(g, x, heightAt(x, -41), -41);
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4; i++) {
        const bag = mesh(
          q,
          sack,
          burlap[(i + row) % 2],
          -1.65 + i * 1.03 + (row % 2) * 0.23,
          0.18 + row * 0.32,
          0,
        );
        bag.scale.set(0.57, 0.205, 0.39);
        bag.rotation.y = (random() - 0.5) * 0.16;
      }
    collide(x, -41, 4.5, 0.86, "stone", 0.99);
  }
  generator(g, 9, -46, collide);
  placard(g, -3, -38, "北坡哨营");
}
export function dressYard(g, collide) {
  placard(g, 2.8, -2.4, "北 ↑ 哨营");
  reel(g, -3.7, 4.25, collide);
  generator(g, 3.9, -4.3, collide);
  for (const [x, z] of [
    [-43, -35],
    [42, 8],
    [7, 52],
    [-39, 35],
  ])
    reel(g, x, z, collide);
  for (const [x, z] of [
    [-44, 8],
    [36, 58],
    [33, -36],
  ])
    generator(g, x, z, collide);
  // Dockside maintenance cart, traffic drums and salvaged pipe sections.
  const cart = group(g, -2.8, 0, -3);
  box(cart, 0, 0.61, 0, 1.5, 0.12, 0.84, red);
  for (const s of [-1, 1]) {
    box(cart, s * 0.73, 0.86, 0, 0.07, 0.46, 0.84, red);
    for (const j of [-0.31, 0.31])
      cylinder(cart, s * 0.58, 0.28, j, 0.23, 0.23, 0.12, rubber).rotation.x =
        Math.PI / 2;
  }
  beam(cart, [-0.74, 0.7, 0], [-1.56, 1.23, 0], 0.047, iron);
  collide(-2.8, -3, 1.56, 0.9, "metal", 1.1);
  for (const [x, z] of [
    [-11, 1],
    [-47, 19],
    [10, 17],
  ]) {
    const p = group(g, x, heightAt(x, z), z);
    for (const [xx, y] of [
      [-0.47, 0.47],
      [0.46, 0.47],
      [0, 1.29],
    ]) {
      mesh(p, new T.TorusGeometry(0.41, 0.073, 8, 24), iron, xx, y, 1.61);
      const shell = mat(0x636c69, 0.55).clone();
      shell.side = T.DoubleSide;
      mesh(
        p,
        new T.CylinderGeometry(0.47, 0.47, 3.2, 24, 1, true),
        shell,
        xx,
        y,
        0,
      ).rotation.x = Math.PI / 2;
    }
    collide(x, z, 1.9, 3.3, "metal", 1.76);
  }
}
