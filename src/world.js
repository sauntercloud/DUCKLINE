import { buildTerrain, heightAt } from "./terrain.js";
import { buildCamp, dressYard } from "./yard-props.js";
import { yard, districts } from "./yard-layout.js";
import asphaltColor from "./assets/textures/asphalt-diff.webp";
import asphaltNormal from "./assets/textures/asphalt-nor_gl.webp";
import asphaltRoughness from "./assets/textures/asphalt-rough.webp";
import * as T from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import {
  box,
  oval,
  beam,
  mat,
  group,
  mesh,
  cylinder,
  canvasTex,
  random,
  batch,
} from "./model.js";

export const extractionRange = 2.65;
export const obstacles = [],
  lots = [],
  supply = [6.3, -45.6],
  breach = [-22.5, yard.south - 1.4],
  roadExit = [breach[0], yard.south + 7];
export const gapHalf = 3.8;
let breachOpen = false;
const dark = mat(0x252a28, 0.65),
  silver = mat(0x878f86, 0.72),
  yellow = mat(0xdda33f, 0.28),
  wood = mat(0x876641);
const groundMask = canvasTex(128, 128, (c) => {
  let g = c.createRadialGradient(64, 64, 13, 64, 64, 63);
  g.addColorStop(0, "rgba(9,11,10,.76)");
  g.addColorStop(0.61, "rgba(9,11,10,.43)");
  g.addColorStop(1, "rgba(9,11,10,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
});
const shadowMat = new T.MeshBasicMaterial({
  map: groundMask,
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
});
function shade(p, x, z, w, d) {
  let o = mesh(p, new T.PlaneGeometry(w, d), shadowMat, x, 0.026, z);
  o.rotation.x = -Math.PI / 2;
  o.castShadow = false;
  o.receiveShadow = false;
  return o;
}
const cells = new Map(),
  cellWidth = 8;
function cellKey(x, z) {
  return Math.floor(x / cellWidth) + 64 * Math.floor(z / cellWidth);
}
const cameraSolids = [];
function cameraBox(x, z, w, d, base, top) {
  const y = heightAt(x, z);
  cameraSolids.push(
    new T.Box3(
      new T.Vector3(x - w / 2 - 0.18, base + y - 0.18, z - d / 2 - 0.18),
      new T.Vector3(x + w / 2 + 0.18, top + y + 0.18, z + d / 2 + 0.18),
    ),
  );
}
// Raise the eye near a roof edge without pulling it toward the duck.
export function cameraLift(eye) {
  let lift = Math.max(0, heightAt(eye.x, eye.z) + 0.5 - eye.y);
  for (const bounds of cameraSolids) {
    if (bounds.disabled) continue;
    const { min, max } = bounds;
    if (eye.y > max.y + 0.45 || eye.y < min.y - 0.45) continue;
    const dx = Math.max(0, min.x - eye.x, eye.x - max.x);
    const dz = Math.max(0, min.z - eye.z, eye.z - max.z);
    const margin = Math.max(dx, dz);
    if (margin > 2) continue;
    const weight = 1 - T.MathUtils.smoothstep(margin, 0, 2);
    lift = Math.max(lift, (max.y + 0.45 - eye.y) * weight);
  }
  return lift;
}
function collide(x, z, w, d, material = "metal", height = 1.2) {
  cameraBox(x, z, w, d, 0, height);
  const o = { x, z, w, d, material, top: heightAt(x, z) + height };
  o.cameraBounds = cameraSolids.at(-1);
  obstacles.push(o);
  for (
    let i = Math.floor((x - w / 2 - 1) / cellWidth);
    i <= Math.floor((x + w / 2 + 1) / cellWidth);
    i++
  )
    for (
      let j = Math.floor((z - d / 2 - 1) / cellWidth);
      j <= Math.floor((z + d / 2 + 1) / cellWidth);
      j++
    ) {
      const key = i + 64 * j;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(o);
    }
  return o;
}
export function blocked(x, z, r = 0.38) {
  if (
    x < yard.west + 0.55 ||
    x > yard.east - 0.55 ||
    z < yard.north + 0.55 ||
    (z > yard.south - 0.55 && (!breachOpen || Math.abs(x - breach[0]) > gapHalf - r || z > roadExit[1] + 2))
  )
    return true;
  return (
    cells
      .get(cellKey(x, z))
      ?.some(
        (o) =>
          !o.disabled && Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r,
      ) ?? false
  );
}
function scratch(c, w, h, n) {
  for (let i = 0; i < n; i++) {
    let a = random();
    c.fillStyle =
      a > 0.53
        ? "rgba(28,21,12," + random() * 0.24 + ")"
        : "rgba(225,209,171," + random() * 0.2 + ")";
    c.fillRect(
      random() * w,
      random() * h,
      random() * 4 + 0.5,
      random() * 3 + 0.4,
    );
  }
}
function labelTexture(word, serial) {
  return canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = "#d1d0b9";
    c.font = "italic 900 93px Arial";
    c.fillText(word, 56, 155);
    c.font = "bold 17px monospace";
    c.fillText("GREYPORT  /  MARITIME LOGISTICS", 60, 183);
    c.font = "bold 19px monospace";
    c.fillText("GPCU " + serial, 732, 68);
    c.fillText("22G1", 732, 94);
    c.fillStyle = "#c9a944";
    c.fillRect(938, 148, 50, 34);
    c.fillStyle = "#302c23";
    c.font = "bold 11px Arial";
    c.fillText("CAUTION", 940, 169);
    c.fillStyle = "#c3c3b0";
    c.fillRect(758, 155, 35, 35);
    c.fillStyle = "#303836";
    c.font = "bold 26px monospace";
    c.fillText("↟", 767, 183);
    c.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 10500; i++) {
      c.globalAlpha = random() * 0.8;
      c.fillRect(
        random() * w,
        random() * h,
        0.8 + random() * 3,
        0.8 + random() * 4,
      );
    }
  });
}
function weather(base) {
  return canvasTex(768, 384, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    scratch(c, w, h, 19000);
    for (let i = 0; i < 440; i++) {
      const x = random() * w,
        y = random() > 0.75 ? random() * h : 0,
        len = random() * h * 0.75;
      const grad = c.createLinearGradient(0, y, 0, y + len);
      grad.addColorStop(0, "rgba(90,53,30," + random() * 0.35 + ")");
      grad.addColorStop(1, "rgba(60,37,28,0)");
      c.fillStyle = grad;
      c.fillRect(x, y, 1 + random() * 4, len);
    }
    for (let i = 0; i < 2000; i++) {
      const x = random() * w,
        y = random() > 0.5 ? random() ** 4 * h : h - random() ** 4 * h;
      c.fillStyle = random() > 0.4 ? "#76523b" : "#422f26";
      c.globalAlpha = random() * 0.65;
      c.fillRect(x, y, random() * 8 + 0.5, random() * 2 + 0.3);
    }
    c.globalAlpha = 1;
  });
}
const paints = ["#436374", "#ac5139", "#476863", "#83704f", "#70818a"].map(
  (c) =>
    new T.MeshStandardMaterial({
      map: weather(c),
      roughness: 0.64,
      metalness: 0.4,
    }),
);
const frames = [0x3a535d, 0x874636, 0x455e56, 0x6d5d45, 0x596972].map((c) =>
  mat(c, 0.48, 0.57),
);
const logos = [
  "NORTHLINE",
  "GREYPORT",
  "TIDAL CO.",
  "PORT AUTH.",
  "NORTHLINE",
].map(
  (l, i) =>
    new T.MeshStandardMaterial({
      map: labelTexture(l, 587420 + i * 527),
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.8,
      depthWrite: false,
    }),
);
function ribbed(g, w, h, d, material) {
  const pos = [],
    uv = [],
    idx = [];
  function panel(points, up) {
    const base = pos.length / 3;
    points.forEach((p, i) => {
      for (let j = 0; j < 2; j++) {
        pos.push(p[0] + j * up[0], p[1] + j * up[1], p[2] + j * up[2]);
        uv.push(i / (points.length - 1), j);
      }
    });
    for (let i = 0; i < points.length - 1; i++) {
      let k = base + i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const pts = [],
    n = Math.round(w / 0.36);
  for (let i = 0; i < n; i++)
    for (const [frac, dep] of [
      [0, 0],
      [0.19, 0],
      [0.31, 0.052],
      [0.73, 0.052],
      [0.86, 0],
    ])
      pts.push([-w / 2 + ((i + frac) * w) / n, dep]);
  pts.push([w / 2, 0]);
  panel(
    pts.map(([x, b]) => [x, 0.09, d / 2 + b]),
    [0, h - 0.18, 0],
  );
  panel(
    pts
      .slice()
      .reverse()
      .map(([x, b]) => [x, 0.09, -d / 2 - b]),
    [0, h - 0.18, 0],
  );
  panel(
    pts.map(([x, b]) => [x, h + b, d / 2]),
    [0, 0, -d],
  );
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  mesh(g, geo, material, 0, 0, 0);
}
function container(p, x, z, angle, color, w = 8.2, y = 0) {
  const d = 3.15,
    h = 3.14,
    g = group(p, x, y, z);
  g.rotation.y = angle;
  const steel = frames[color];
  ribbed(g, w, h, d, paints[color]);
  for (const s of [-1, 1]) {
    for (const yy of [0.095, h - 0.055])
      box(g, 0, yy, s * (d / 2 + 0.046), w + 0.03, 0.16, 0.115, steel);
    for (const xx of [-1, 1]) {
      box(
        g,
        xx * (w / 2 - 0.066),
        h / 2,
        s * (d / 2 + 0.012),
        0.16,
        h,
        0.17,
        steel,
      );
      for (const yy of [0.11, h - 0.1])
        box(g, (xx * w) / 2, yy, (s * d) / 2, 0.22, 0.21, 0.21, steel);
    }
    const logo = mesh(
      g,
      new T.PlaneGeometry(w * 0.94, h * 0.77),
      logos[color],
      0,
      h * 0.53,
      s * (d / 2 + 0.066),
    );
    logo.rotation.y = s > 0 ? 0 : Math.PI;
    logo.castShadow = false;
    const end = s * (w / 2 + 0.018);
    for (const zz of [-0.78, 0.78]) {
      box(g, end, h / 2, zz, 0.095, h - 0.22, 1.49, paints[color]);
      for (let j = 0; j < 4; j++)
        box(g, end + s * 0.077, 0.5 + j * 0.67, zz, 0.052, 0.087, 1.34, steel);
      for (let j of [-0.43, 0.43]) {
        cylinder(
          g,
          end + s * 0.115,
          h / 2,
          zz + j,
          0.034,
          0.034,
          h - 0.35,
          silver,
          8,
        );
        for (const yy of [0.35, 1.33, 2.68])
          box(g, end + s * 0.126, yy, zz + j, 0.085, 0.084, 0.17, dark);
        box(
          g,
          end + s * 0.16,
          1.12,
          zz + j + 0.087,
          0.077,
          0.053,
          0.235,
          silver,
        );
      }
    }
  }
  if (y > 0) {
    const turn = Math.abs(Math.sin(angle)) > 0.5;
    cameraBox(x, z, turn ? d : w, turn ? w : d, y, y + h);
  }
  if (y === 0) {
    const turn = Math.abs(Math.sin(angle)) > 0.5;
    collide(x, z, turn ? d : w, turn ? w : d, "metal", h);
    lots.push({ x, z, w: turn ? d : w, d: turn ? w : d, color });
    shade(p, x, z, (turn ? d : w) + 2, (turn ? w : d) + 2);
  }
}
const timber = new T.MeshStandardMaterial({
  map: canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = "#977751";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      c.fillStyle =
        random() > 0.5 ? "rgba(41,28,17,.16)" : "rgba(206,181,135,.16)";
      c.fillRect(
        random() * w,
        random() * h,
        random() * 70 + 0.7,
        random() * 1.6 + 0.25,
      );
    }
    for (let j = 0; j < 6; j++) {
      c.fillStyle = "rgba(47,38,27,.65)";
      c.fillRect(0, (j * h) / 6, w, 3);
    }
  }),
  roughness: 0.89,
});
function crate(p, x, z, s = 1.48, y = 0) {
  const g = group(p, x, y, z);
  box(g, 0, s / 2, 0, s, s, s, timber);
  for (const f of [-1, 1]) {
    for (const v of [-1, 1]) {
      box(g, v * s * 0.43, s * 0.5, f * s * 0.508, 0.13, s, 0.087, wood);
      box(g, 0, s * (0.5 + v * 0.43), f * s * 0.51, s, 0.12, 0.08, wood);
      box(g, f * s * 0.506, s * 0.5, v * s * 0.43, 0.08, s, 0.12, wood);
      box(g, f * s * 0.511, s * (0.5 + v * 0.43), 0, 0.082, 0.12, s, wood);
      box(g, v * s * 0.39, s + 0.018, 0, 0.095, 0.051, s, dark);
    }
    box(g, 0, s * 0.5, f * s * 0.523, 0.122, s * 1.17, 0.059, wood).rotation.z =
      -0.75;
    box(g, f * s * 0.523, s * 0.5, 0, 0.058, s * 1.17, 0.125, wood).rotation.x =
      0.75;
  }
  if (y) cameraBox(x, z, s + 0.12, s + 0.12, y, y + s);
  if (!y) {
    collide(x, z, s + 0.12, s + 0.12, "wood", s);
    shade(p, x, z, s + 1, s + 1);
  }
}
function barrel(p, x, z, col = 0) {
  const g = group(p, x, 0, z),
    paint = mat([0x52635c, 0x9b5839, 0x516675][col], 0.52, 0.52);
  cylinder(g, 0, 0.58, 0, 0.415, 0.405, 1.15, paint, 24);
  for (const y of [0.06, 0.37, 0.8, 1.14])
    cylinder(g, 0, y, 0, 0.431, 0.431, 0.044, dark, 24);
  cylinder(g, 0, 1.17, 0, 0.4, 0.4, 0.033, paint, 24);
  cylinder(g, 0.21, 1.194, 0.12, 0.064, 0.064, 0.027, silver, 10);
  box(g, 0, 0.56, 0.41, 0.18, 0.16, 0.018, mat(0xd6c09b));
  collide(x, z, 0.83, 0.83);
  shade(p, x, z, 1.5, 1.5);
}
function forklift(p, x, z, rot) {
  const g = group(p, x, 0, z);
  g.rotation.y = rot;
  for (const side of [-1, 1])
    for (const zz of [-0.81, 0.85]) {
      const wheel = cylinder(
        g,
        side * 0.82,
        0.46,
        zz,
        0.43,
        0.43,
        0.25,
        dark,
        24,
      );
      wheel.rotation.z = Math.PI / 2;
      cylinder(
        g,
        side * 0.961,
        0.46,
        zz,
        0.234,
        0.234,
        0.04,
        mat(0x686755, 0.6),
        16,
      ).rotation.z = Math.PI / 2;
    }
  box(g, 0, 0.67, 0, 1.6, 0.48, 2.54, yellow);
  box(g, 0, 1.01, -0.82, 1.57, 0.6, 0.96, yellow);
  box(g, 0, 1.32, -0.83, 1.4, 0.045, 0.76, dark);
  for (let i = 0; i < 7; i++)
    box(g, -0.45 + i * 0.15, 1.35, -0.8, 0.056, 0.025, 0.49, mat(0x5f6054));
  box(g, 0, 1.12, -0.14, 0.66, 0.14, 0.61, dark);
  box(g, 0, 1.41, -0.41, 0.65, 0.56, 0.11, dark).rotation.x = -0.12;
  for (const s of [-1, 1])
    for (const t of [-1, 1])
      beam(
        g,
        [s * 0.69, 1.03, t * 0.66],
        [s * 0.64, 2.66, t * 0.61],
        0.064,
        dark,
      );
  box(g, 0, 2.7, 0, 1.65, 0.14, 1.65, yellow);
  for (const s of [-1, 1]) {
    box(g, s * 0.54, 1.72, 1.26, 0.14, 3.2, 0.21, dark);
    box(g, s * 0.48, 1.54, 1.4, 0.07, 2.8, 0.08, silver);
    box(g, s * 0.47, 0.31, 2.16, 0.17, 0.1, 1.55, dark);
  }
  box(g, 0, 2.98, 1.26, 1.18, 0.14, 0.2, dark);
  box(g, 0, 0.7, 1.5, 1.3, 0.52, 0.12, dark);
  beam(g, [0, 0.93, 0.56], [0, 1.5, 0.43], 0.045, dark);
  const sw = mesh(
    g,
    new T.TorusGeometry(0.19, 0.025, 8, 20),
    dark,
    0,
    1.48,
    0.44,
  );
  sw.rotation.x = 1.14;
  for (const s of [-1, 1])
    box(g, s * 0.63, 2.59, 0.79, 0.25, 0.13, 0.07, mat(0xf5d3a0));
  cylinder(g, 0.5, 2.84, -0.43, 0.076, 0.09, 0.17, mat(0xe18231));
  collide(x, z, 2.9, 3.5, "metal", 3);
  shade(p, x, z, 3.5, 4.5);
}
function marking(p, x, z, w, d, txt, rot = 0) {
  const m = new T.MeshStandardMaterial({
    map: canvasTex(640, 180, (c, W, H) => {
      c.fillStyle = "#e0c995";
      c.font = "900 140px Helvetica Neue, Arial";
      c.textAlign = "center";
      c.fillText(txt, W / 2, 139);
      c.globalCompositeOperation = "destination-out";
      scratch(c, W, H, 18000);
      for (let i = 0; i < 5000; i++) {
        c.globalAlpha = random();
        c.fillRect(random() * W, random() * H, 1 + random() * 5, random() * 4);
      }
    }),
    transparent: true,
    depthWrite: false,
    roughness: 0.96,
    opacity: 0.65,
  });
  const obj = mesh(p, new T.PlaneGeometry(w, d), m, x, 0.038, z);
  obj.rotation.set(-Math.PI / 2, 0, rot);
  obj.castShadow = false;
}
const warmLamp = new T.MeshBasicMaterial({
  color: new T.Color(3.8, 1.85, 0.53),
});
function lampe(p, x, z, height = 5) {
  const g = group(p, x, 0, z);
  box(g, 0, 0.18, 0, 0.58, 0.36, 0.58, mat(0x73766c));
  cylinder(g, 0, height / 2, 0, 0.063, 0.11, height, dark);
  beam(g, [0, height, 0], [0.86, height + 0.18, 0], 0.059, dark);
  const hood = group(g, 0.86, height + 0.09, 0);
  hood.rotation.z = 0.2;
  box(hood, 0, 0, 0, 0.7, 0.19, 0.4, dark);
  box(hood, 0, -0.106, 0, 0.59, 0.025, 0.32, warmLamp);
  return [x + 0.86, height - 0.1, z];
}
function fence(p, x1, z1, x2, z2) {
  const dx = x2 - x1,
    dz = z2 - z1,
    len = Math.hypot(dx, dz),
    g = group(p, x1, 0, z1);
  g.rotation.y = -Math.atan2(dz, dx);
  const wire = mat(0x535c57, 0.6);
  for (let j = 0; j <= Math.ceil(len / 2.5); j++) {
    let xx = Math.min(j * 2.5, len);
    cylinder(g, xx, 1.2, 0, 0.044, 0.055, 2.4, wire, 8);
    beam(g, [xx, 2.35, 0], [xx, 2.61, -0.14], 0.029, wire);
  }
  for (const yy of [0.18, 2.14, 2.56])
    beam(g, [0, yy, 0], [len, yy, 0], 0.021, wire);
  const t = canvasTex(64, 64, (c) => {
    c.strokeStyle = "#9b9f93";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(64, 64);
    c.moveTo(64, 0);
    c.lineTo(0, 64);
    c.stroke();
  });
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(len / 0.33, 6);
  const m = new T.MeshStandardMaterial({
    map: t,
    transparent: true,
    alphaTest: 0.2,
    side: T.DoubleSide,
    roughness: 0.7,
  });
  mesh(g, new T.PlaneGeometry(len, 1.93), m, len / 2, 1.14, 0);
}
function barrier(p, x, z) {
  const g = group(p, x, 0, z);
  box(g, 0, 0.42, 0, 2.7, 0.78, 0.65, mat(0x8a8978));
  box(g, 0, 0.13, 0, 2.85, 0.24, 0.92, mat(0x797c72));
  for (let i = 0; i < 6; i++)
    box(
      g,
      -1.14 + i * 0.437,
      0.62,
      0.332,
      0.16,
      0.34,
      0.013,
      yellow,
    ).rotation.z = -0.47;
  collide(x, z, 2.85, 0.92, "stone", 0.82);
  shade(p, x, z, 3.5, 1.7);
}
function caseBox(p, x, z) {
  const g = group(p, x, 0, z),
    m = mat(0x6d7958, 0.3);
  box(g, 0, 0.4, 0, 1.36, 0.67, 0.83, m);
  box(g, 0, 0.75, 0, 1.41, 0.12, 0.88, m);
  for (let i = 0; i < 5; i++)
    box(g, -0.51 + i * 0.25, 0.817, 0, 0.06, 0.035, 0.71, strapM);
  for (const s of [-1, 1]) {
    box(g, s * 0.43, 0.43, 0.432, 0.089, 0.59, 0.038, dark);
    box(g, s * 0.43, 0.63, 0.46, 0.12, 0.115, 0.045, silver);
  }
  shade(p, x, z, 2.4, 1.8);
  collide(x, z, 1.43, 0.92, "metal", 0.83);
  return g;
}
const strapM = mat(0x455342);
export function createWorld(scene) {
  const stat = group(scene),
    loader = new T.TextureLoader(),
    floorMap = (url, srgb = false) => {
      const t = loader.load(url);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(32, 32);
      t.anisotropy = 8;
      if (srgb) t.colorSpace = T.SRGBColorSpace;
      return t;
    };
  const asphalt = new T.MeshStandardMaterial({
    color: 0x69797b,
    map: floorMap(asphaltColor, true),
    normalMap: floorMap(asphaltNormal),
    normalScale: new T.Vector2(0.56, 0.56),
    roughnessMap: floorMap(asphaltRoughness),
    roughness: 0.79,
    metalness: 0.17,
  });
  const floor = mesh(scene, new T.PlaneGeometry(200, 200), asphalt, 0, 0, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  buildTerrain(scene);
  const shader = Reflector.ReflectorShader;
  const puddleShader = {
    ...shader,
    vertexShader: shader.vertexShader
      .replace(
        "uniform mat4 textureMatrix;",
        "uniform mat4 textureMatrix; varying vec2 surface;",
      )
      .replace("vUv =", "surface = position.xy; vUv ="),
    fragmentShader: shader.fragmentShader
      .replace(
        "uniform vec3 color;",
        `varying vec2 surface;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
 uniform vec3 color;`,
      )
      .replace(
        "vec4 base = texture2DProj( tDiffuse, vUv );",
        `float n=noise(surface*vec2(.45,.72))*.55+noise(surface*1.24)*.25+noise(surface*3.)*.14+noise(surface*11.)*.06;
 float mask=smoothstep(.43,.67,n); if(mask<.018)discard;
 vec4 coord=vUv;coord.xy+=vec2(noise(surface*18.)-.5,noise(surface*9.)-.5)*.0024*coord.w;
 vec4 base=texture2DProj(tDiffuse,coord);`,
      )
      .replace(
        "vec4( blendOverlay( base.rgb, color ), 1.0 )",
        "vec4(base.rgb*.62+vec3(.025,.032,.033),mask*.41)",
      ),
  };
  const wet = new Reflector(new T.PlaneGeometry(180, 180), {
    clipBias: 0.002,
    textureWidth: 1024,
    textureHeight: 640,
    multisample: 0,
    shader: puddleShader,
  });
  wet.rotation.x = -Math.PI / 2;
  wet.position.y = 0.013;
  wet.material.transparent = true;
  wet.material.depthWrite = false;
  wet.renderOrder = 1;
  scene.add(wet);
  const reflect = wet.onBeforeRender;
  let reflFrame = 0;
  let reflectionDirty = true;
  function invalidateReflection() {
    reflectionDirty = true;
  }
  wet.onBeforeRender = function (...args) {
    if (reflFrame++ % 5 !== 0 && !reflectionDirty) return;
    reflectionDirty = false;
    reflect.apply(this, args);
  };
  // Loading lanes and the faded parking grids.
  const stripeTexture = canvasTex(512, 32, (c, w, h) => {
    c.fillStyle = "#b69a56";
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 3200; i++) {
      c.globalAlpha = random() * 0.9;
      c.fillRect(
        random() * w,
        random() * h,
        random() * 6 + 1,
        random() * 4 + 1,
      );
    }
  });
  const stripe = new T.MeshStandardMaterial({
    map: stripeTexture,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
  });
  function line(x, z, w, d) {
    const o = mesh(stat, new T.PlaneGeometry(w, d), stripe, x, 0.033, z);
    o.rotation.x = -Math.PI / 2;
    o.castShadow = false;
  }
  for (let z = -27; z < 24; z += 3) {
    line(2.05, z, 0.12, 1.85);
    line(-16.8, z, 0.12, 2.0);
  }
  for (let z = -21; z < 24; z += 6) {
    line(-9.9, z, 11, 0.085);
    line(11, z, 11, 0.085);
  }
  for (const x of [-15.4, -4.4, 5.5, 16.5]) line(x, 0, 0.09, 47);
  marking(stat, -2.2, 3, 3.65, 1.8, "B–01");
  marking(stat, 5.05, -3.2, 2.8, 1.4, "SLOW");
  marking(stat, -2, -14, 3, 1.3, "DOCK");
  const placements = [
    [-9.2, -3.9, 0, 0, 8.2],
    [-10.5, -8.0, 0, 2, 8.0],
    [-10.5, -8.0, 0, 1, 8, 3.18],
    [3.05, -8.45, 0, 1, 9.3],
    [3.1, -12.1, 0, 0, 9.3],
    [3.1, -12.1, 0, 2, 9.3, 3.18],
    [12.1, -4.4, Math.PI / 2, 2, 8.2],
    [16, -5.3, Math.PI / 2, 1, 8.2],
    [-9.6, 9, 0, 2, 7.6],
    [-10, 13, 0, 0, 8.4],
    [11, 9.4, 0, 0, 8],
    [13, 13.1, 0, 3, 8.2],
    [13, 13.1, 0, 1, 8.2, 3.18],
    [-8, -18.3, 0, 3, 8.2],
    [4.4, -22, 0, 0, 9.3],
    [14, -21, 0, 1, 8],
    [-21, -6, Math.PI / 2, 1, 9],
    [-20.8, 6, Math.PI / 2, 0, 9],
    [-4, 21, 0, 1, 9.2],
    [21, 1, Math.PI / 2, 0, 9],
    [22, 9, Math.PI / 2, 2, 8],
  ];
  placements.forEach((a) => container(stat, ...a));
  for (const [x, z, s, y] of [
    [-7, 2.9, 1.6],
    [-8.7, 3.1, 1.62],
    [-7.95, 2.99, 1.35, 1.66],
    [-9, 4.8, 1.42],
    [6.1, -5.6, 1.28],
    [7.6, -5.5, 1.51],
    [7.6, -5.5, 1.25, 1.54],
    [-12, -13.2, 1.5],
    [8.3, -17.7, 1.6],
    [3.4, 12, 1.15],
    [-13, 7, 1.34],
  ])
    crate(stat, x, z, s, y);
  for (const [x, z, c] of [
    [-4.85, -2.5, 1],
    [-4.9, -3.47, 2],
    [-5.78, -2.23, 0],
    [5.8, -3.85, 1],
    [6.73, -4.09, 0],
    [-6.2, 4.3, 2],
    [10.2, -14.1, 1],
    [-13.4, 9.4, 2],
    [10, 6.7, 0],
  ])
    barrel(stat, x, z, c);
  forklift(stat, 7.9, 2.15, -1.03);
  for (const [x, z] of [
    [-2.5, 7.2],
    [0.8, 7.2],
    [5.3, -17],
    [-16, 2.3],
  ])
    barrier(stat, x, z);
  caseBox(group(stat, 0, heightAt(...supply), 0), ...supply);
  const { west, east, north, south } = yard;
  fence(stat, west, north, east, north);
  fence(stat, west, south, breach[0] - gapHalf, south);
  fence(stat, breach[0] + gapHalf, south, east, south);
  fence(stat, west, north, west, south);
  fence(stat, east, north, east, south);
  // Cross-yard vehicle lanes link the original loading bay to all eight districts.
  for (const x of [-22.5, 22.5])
    for (let z = north + 2; z < south; z += 5) line(x, z, 0.14, 2.6);
  for (const z of [-25, 25])
    for (let x = west + 2; x < east; x += 5) line(x, z, 2.6, 0.14);
  const lampPositions = [
    lampe(stat, -4.85, -5.9, 4.1),
    lampe(stat, 6.95, 5.74, 4.5),
    lampe(stat, -13.8, 10, 4.3),
    lampe(stat, 11.7, -16.5, 4.5),
  ];
  for (const [x, y, z] of lampPositions) {
    const l = new T.PointLight(0xffb45c, 52, 10, 2);
    l.position.set(x, y - 0.22, z);
    scene.add(l);
  }
  // Drain grates, discarded paperwork, stone chips and shipping dunnage.
  for (const [x, z] of [
    [3.8, 3.7],
    [-3.7, -1.1],
    [1.1, -14.8],
    [-14.5, 4],
  ]) {
    box(stat, x, 0.021, z, 0.57, 0.045, 1.4, dark);
    for (let i = 0; i < 13; i++)
      box(stat, x, 0.05, z - 0.59 + i * 0.1, 0.53, 0.034, 0.036, silver);
  }
  for (let i = 0; i < 260; i++) {
    let x = random() * 37 - 18,
      z = random() * 43 - 25,
      s = 0.025 + random() * 0.066;
    let o = box(
      stat,
      x,
      0.035,
      z,
      s * 2,
      0.038,
      s,
      mat([0x59594e, 0x434642, 0x7c7564, 0x57564d][i % 4]),
    );
    o.rotation.y = random() * 6;
  }
  for (let i = 0; i < 44; i++) {
    let x = random() * 35 - 17,
      z = random() * 41 - 24;
    const o = box(
      stat,
      x,
      0.034,
      z,
      0.14 + random() * 0.18,
      0.008,
      0.13 + random() * 0.22,
      mat(i % 3 ? 0x9c9986 : 0x8a755b),
    );
    o.rotation.y = random() * 6;
  }
  // Coiled dock cable.
  for (let i = 0; i < 3; i++) {
    let o = mesh(
      stat,
      new T.TorusGeometry(0.39 + i * 0.065, 0.032, 6, 28),
      dark,
      -6.2,
      0.055 + i * 0.014,
      1.54,
    );
    o.rotation.x = Math.PI / 2;
  }
  const path = new T.CatmullRomCurve3(
    [
      [-6.4, 0.055, 1.55],
      [-5.4, 0.055, 1.35],
      [-4.6, 0.055, 1.7],
      [-3.8, 0.055, 1.04],
      [-3.67, 0.055, 0.4],
    ].map((v) => new T.Vector3(...v)),
  );
  mesh(stat, new T.TubeGeometry(path, 32, 0.025, 5, false), dark, 0, 0, 0);
  const xRoad = breach[0];
  // The spur runs through the opening and joins the coastal highway outside the fence.
  box(stat, xRoad, 0.027, south + 2, gapHalf * 2, 0.042, 23, mat(0x454b4a));
  box(stat, 0, 0.045, roadExit[1] + 2, 180, 0.055, 7.5, mat(0x494e4e));
  for (let x = -87; x < 88; x += 5)
    box(stat, x, 0.079, roadExit[1] + 2, 2.8, 0.012, 0.14, mat(0xd6bc7b));
  for (const side of [-1, 1]) {
    box(stat, xRoad + side * 3.48, 0.053, south - 0.3, 0.13, 0.01, 15, mat(0xcfcab2));
    for (let i = 0; i < 3; i++) {
      const x = xRoad + side * 4.1, z = south + 2.7 * i;
      box(stat, x, 0.48, z, 0.16, 0.96, 0.16, dark);
      box(stat, x, 0.85, z, 0.17, 0.13, 0.17, yellow);
    }
  }
  marking(stat, xRoad, south - 6.4, 4.4, 1.5, "S–06", Math.PI);
  const roadSign = group(stat, xRoad + 4.7, 0, south + 6);
  for (const sx of [-0.95, 0.95]) box(roadSign, sx, 1.55, 0, 0.09, 3.1, 0.09, silver);
  box(roadSign, 0, 2.98, 0, 2.75, 1.18, 0.08, dark);
  const signFace = canvasTex(512, 216, (c, w, h) => {
    c.fillStyle = "#345951";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = c.fillStyle = "#efe8cd";
    c.lineWidth = 5;
    c.strokeRect(9, 9, w - 18, h - 18);
    c.font = "bold 66px sans-serif";
    c.fillText("海岸公路", 26, 105);
    c.font = "bold 31px monospace";
    c.fillText("COAST ROAD", 29, 163);
    c.font = "bold 94px sans-serif";
    c.fillText("→", 377, 140);
  });
  mesh(roadSign, new T.PlaneGeometry(2.71, 1.14),
    new T.MeshStandardMaterial({ map: signFace }), 0, 2.98, -0.045).rotation.y = Math.PI;
  for (let x = -85; x < 84; x += 5) {
    box(stat, x, 0.57, roadExit[1] + 6.1, 0.14, 1.14, 0.13, silver);
    box(stat, x + 2.5, 0.86, roadExit[1] + 6.1, 5.01, 0.22, 0.12, silver);
    box(stat, x, 0.87, roadExit[1] + 6, 0.24, 0.09, 0.05, yellow);
  }
  const grit = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = "#c6c4b9";
    c.fillRect(0, 0, w, h);
    scratch(c, w, h, 14500);
  });
  const stone = [0x68685c, 0x848376, 0x777467, 0x908b78].map(color =>
    new T.MeshStandardMaterial({ color, map: grit, bumpMap: grit, bumpScale: 0.045, roughness: 0.96 }));
  const rocks = [];
  const rockGeo = new T.DodecahedronGeometry(1);
  for (let i = 0; i < 15; i++) {
    const col = i % 6, row = Math.floor(i / 6);
    const x = row === 2 ? (col - 1) * 1.22 : (col - 2.5) * 1.28;
    const rock = mesh(scene, rockGeo, stone[i % 4],
      xRoad + x, 0.52 + row * 0.78, south - 0.16 + Math.sin(i * 2.3) * 0.38);
    rock.scale.set(1.05 + (i % 3) * 0.12, 0.79, 0.86);
    rock.rotation.set(i * 0.52, i * 1.63, i * 0.27);
    const start = rock.position.clone(), sign = x < 0 ? -1 : 1;
    const landing = new T.Vector3(xRoad + sign * (4.8 + (i % 3) * 0.66),
      0.32 + (i % 2) * 0.28, south - 2.2 + (i % 7) * 0.81);
    rocks.push({ rock, start, landing });
  }
  const wall = collide(xRoad, south - 0.16, gapHalf * 2, 1.88, "stone", 2.9);
  const pack = group(scene);
  box(pack, 0, 0.23, 0, 0.7, 0.43, 0.5, mat(0xa96936));
  for (const x of [-0.23, 0.23]) box(pack, x, 0.24, 0, 0.072, 0.46, 0.52, dark);
  box(pack, 0, 0.48, 0, 0.23, 0.045, 0.08, yellow);
  batch(pack);
  function updateBreach(phase, blastAge) {
    breachOpen = phase === "open";
    wall.disabled = wall.cameraBounds.disabled = breachOpen;
    pack.visible = phase === "supply" || phase === "armed";
    if (phase === "supply") pack.position.set(supply[0], heightAt(...supply) + 0.84, supply[1]);
    else pack.position.set(breach[0], 0.24, breach[1] + 0.03);
    rocks.forEach(({rock, start, landing}, i) => {
      const delay = Math.abs(start.x - xRoad) * 0.022;
      const flight = 0.64 + (i % 5) * 0.072;
      const t = breachOpen ? T.MathUtils.clamp((blastAge - delay) / flight, 0, 1) : 0;
      const bounce = T.MathUtils.clamp((blastAge - delay - flight) / 0.28, 0, 1);
      rock.position.lerpVectors(start, landing, 1 - (1 - t) ** 2);
      rock.position.y += 4 * t * (1 - t) * (1.25 + (i % 4) * 0.42)
        + (breachOpen ? 0.86 * bounce * (1 - bounce) : 0);
      rock.rotation.z = i * 0.27 + t * (i % 2 ? 1.9 : -2.4);
    });
  }
  // Rubber lane cones and their reflective collars.
  for (const [x, z] of [
    [4.65, -3.25],
    [5.14, -2.61],
    [-4.1, 6.31],
    [-15.4, -9.25],
  ]) {
    const g = group(stat, x, 0, z);
    box(g, 0, 0.032, 0, 0.33, 0.064, 0.33, dark);
    cylinder(g, 0, 0.263, 0, 0.026, 0.137, 0.42, mat(0xc26837), 12);
    cylinder(g, 0, 0.27, 0, 0.074, 0.093, 0.068, mat(0xd7c8a9), 12);
  }
  dressYard(stat, collide);
  batch(stat);
  const solid = group(scene);
  solid.add(stat);
  const sectors = districts.map((d) => {
    const block = group(solid);
    buildDistrict(block, d);
    batch(block);
    return block;
  });
  return { wet, lampPositions, solid, sectors, updateBreach, invalidateReflection };
}

function buildDistrict(g, { x, z, kind, code }) {
  if (kind === "camp") {
    buildCamp(g, collide);
    return;
  }
  const shell = mat(0x667773, 0.45),
    trim = mat(0x354d50, 0.52),
    roof = mat(0x404c4c, 0.54);
  marking(g, x + 5, z + 9, 7, 2.4, code);
  for (const offset of [-14, 14]) {
    lampe(g, x + offset, z + 13, 5);
    barrier(g, x + offset, z + 16);
  }
  const crateZ = code === "E–06" ? z + 14 : z + 7;
  crate(g, x - 10, crateZ, 1.7);
  crate(g, x - 12, crateZ, 1.7);
  crate(g, x - 11, crateZ, 1.35, 1.73);
  barrel(g, x - 8.3, crateZ, 1);
  container(g, x + 8, z - 14, 0, kind === "rail" ? 0 : 2, 10);
  if (kind === "store") {
    box(g, x - 3, 2.6, z - 4, 19, 5.2, 11, shell);
    collide(x - 3, z - 4, 19, 11, "metal", 5.6);
    shade(g, x - 3, z - 4, 22, 14);
    box(g, x - 3, 5.33, z - 4, 20, 0.3, 12, roof);
    for (let i = -8; i <= 8; i += 2)
      box(g, x - 3 + i, 5.51, z - 4, 0.08, 0.09, 11.9, trim);
    for (const i of [-6, 1]) {
      box(g, x + i, 1.83, z + 1.54, 4.8, 3.62, 0.12, trim);
      for (let j = 0; j < 10; j++)
        box(g, x + i, 0.25 + j * 0.34, z + 1.64, 4.64, 0.05, 0.07, silver);
      box(g, x + i, 4.25, z + 1.65, 2.5, 0.1, 0.32, warmLamp);
    }
    forklift(g, x + 12, z + 3, 1.2);
  } else if (kind === "tank") {
    for (const i of [-9, 4]) {
      cylinder(g, x + i, 2.55, z - 3, 4, 4, 5.1, shell, 32);
      cylinder(g, x + i, 5.3, z - 3, 0.8, 4, 0.55, trim, 32);
      for (const y of [0.18, 2.4, 4.9])
        cylinder(g, x + i, y, z - 3, 4.05, 4.05, 0.12, silver, 32);
      collide(x + i, z - 3, 8, 8, "metal", 5.6);
      shade(g, x + i, z - 3, 10, 10);
      for (const j of [-0.38, 0.38])
        beam(
          g,
          [x + i + j, 0.1, z + 1.12],
          [x + i + j, 5.2, z + 1.12],
          0.06,
          yellow,
        );
      for (let y = 0.35; y < 5.2; y += 0.4)
        beam(
          g,
          [x + i - 0.38, y, z + 1.12],
          [x + i + 0.38, y, z + 1.12],
          0.045,
          yellow,
        );
    }
    beam(g, [x - 9, 3.5, z - 3], [x + 4, 3.5, z - 3], 0.32, silver);
  } else if (kind === "gantry") {
    for (const i of [-12, 12])
      for (const j of [-7, 3]) {
        box(g, x + i, 4.4, z + j, 0.72, 8.8, 0.86, yellow);
        collide(x + i, z + j, 0.72, 0.86, "metal", 8.8);
        box(g, x + i, 0.3, z + j, 1.3, 0.6, 1.4, trim);
      }
    for (const j of [-7, 3]) {
      box(g, x, 8.65, z + j, 25, 0.28, 0.45, yellow);
      box(g, x, 10.1, z + j, 25, 0.26, 0.45, yellow);
      for (let i = -12; i < 12; i += 3)
        beam(g, [x + i, 8.65, z + j], [x + i + 3, 10.1, z + j], 0.095, yellow);
    }
    for (const i of [-12, 1, 12])
      box(g, x + i, 9.9, z - 2, 0.4, 0.42, 11, yellow);
    box(g, x + 2, 8.35, z - 2, 2.3, 1.7, 2.75, trim);
    box(g, x + 2, 8.5, z - 0.59, 1.9, 0.78, 0.08, mat(0x739695, 0.65));
    container(g, x - 3, z - 3, 0, 1, 9);
  } else {
    for (const lane of [-6, 3]) {
      for (const i of [-1, 1])
        box(g, x, 0.081, z + lane + i * 0.77, 38, 0.13, 0.09, silver);
      for (let i = -18; i <= 18; i += 1.2)
        box(g, x + i, 0.035, z + lane, 0.23, 0.065, 2.35, wood);
    }
    for (const i of [-8, 6]) {
      box(g, x + i, 0.72, z - 6, 11, 0.58, 2.9, trim);
      collide(x + i, z - 6, 11, 3);
      for (const a of [-4, 4])
        for (const j of [-1, 1]) {
          const wheel = cylinder(
            g,
            x + i + a,
            0.4,
            z - 6 + j * 0.95,
            0.4,
            0.4,
            0.2,
            dark,
          );
          wheel.rotation.x = Math.PI / 2;
        }
      container(g, x + i, z - 6, 0, i < 0 ? 1 : 0, 9.6, 1.02);
    }
  }
}
