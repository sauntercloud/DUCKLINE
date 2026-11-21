import * as T from "three";
import { mesh, canvasTex, random, group, batch, mat } from "./model.js";

const banks = [
  { x: 0, z: -48, w: 22, d: 21, top: 2.75, flat: 0.57 },
  { x: -27, z: 23, w: 8, d: 12, top: 2.15, flat: 0.12 },
  { x: 27, z: 19, w: 8, d: 11, top: 1.6, flat: 0.17 },
];
function rise(bank, x, z) {
  const u = Math.abs((x - bank.x) / bank.w),
    v = Math.abs((z - bank.z) / bank.d);
  if (u >= 1 || v >= 1) return 0;
  const t = Math.min(
    1,
    Math.max(0, (1 - Math.pow(u ** 4 + v ** 4, 0.25)) / (1 - bank.flat)),
  );
  return bank.top * t * t * (3 - 2 * t);
}
export function heightAt(x, z) {
  for (const b of banks) {
    const y = rise(b, x, z);
    if (y > 0) return y;
  }
  return 0;
}
// Find the first crossing of a height-field surface, including ridges between endpoints.
export function groundRange(x, y, z, dx, slope, dz, limit, offset = 0) {
  if (y + Math.min(0, slope * limit) > 2.75 + offset) return limit;
  for (let t = 0; t <= limit; t = Math.min(t + 0.45, limit)) {
    if (y + slope * t <= heightAt(x + dx * t, z + dz * t) + offset) {
      let lo = Math.max(0, t - 0.45),
        hi = t;
      for (let i = 0; i < 7; i++) {
        const m = (lo + hi) / 2;
        if (y + slope * m > heightAt(x + dx * m, z + dz * m) + offset) lo = m;
        else hi = m;
      }
      return hi;
    }
    if (t === limit) break;
  }
  return limit;
}
export function buildTerrain(scene) {
  const tex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = "#a8997b";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 23500; i++) {
      const n = Math.floor(65 + random() * 120);
      c.fillStyle = "rgba(" + n + "," + (n - 9) + "," + (n - 20) + ",.45)";
      c.fillRect(
        random() * w,
        random() * h,
        1 + random() * 3,
        1 + random() * 2,
      );
    }
  });
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.anisotropy = 8;
  const material = new T.MeshStandardMaterial({
    map: tex,
    vertexColors: true,
    roughness: 1,
  });
  for (const b of banks) {
    const geo = new T.PlaneGeometry(b.w * 2, b.d * 2, b.w * 3, b.d * 3);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position,
      uv = geo.attributes.uv,
      colors = [],
      color = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + b.x,
        z = pos.getZ(i) + b.z,
        y = heightAt(x, z);
      pos.setY(i, y > 0.001 ? y : -0.045);
      uv.setXY(i, x / 3, z / 3);
      const trail = Math.abs(x - b.x - 1.5 * Math.sin(z * 0.33)) < 2.1;
      color.setHex(trail ? 0xcbb591 : y > b.top * 0.93 ? 0xa6a383 : 0x8b9278);
      color.multiplyScalar(
        0.94 + 0.07 * Math.sin(x * 1.2 + z * 0.92) + random() * 0.08,
      );
      colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    mesh(scene, geo, material, b.x, 0, b.z);
    const verge = group(scene),
      stone = new T.IcosahedronGeometry(1, 0),
      blade = new T.ConeGeometry(0.1, 0.68, 3);
    for (let i = 0; i < 170; i++) {
      const x = b.x + (random() * 2 - 1) * b.w,
        z = b.z + (random() * 2 - 1) * b.d,
        y = heightAt(x, z);
      if (y < 0.14 || y > b.top * 0.91 || Math.abs(x - b.x) < 2.8) continue;
      if (i % 5 === 0) {
        const rock = mesh(verge, stone, mat(0x827e70), x, y + 0.08, z);
        rock.scale.set(
          0.23 + random() * 0.8,
          0.16 + random() * 0.38,
          0.3 + random() * 0.7,
        );
        rock.rotation.y = random() * 6;
      } else
        for (let j = 0; j < 5; j++) {
          const reed = mesh(
            verge,
            blade,
            mat(j % 2 ? 0x7f805b : 0xa19a64),
            x + random() * 0.4,
            y + 0.23,
            z + random() * 0.4,
          );
          reed.rotation.z = (random() - 0.5) * 0.7;
          reed.rotation.x = (random() - 0.5) * 0.65;
        }
    }
    batch(verge);
  }
}
