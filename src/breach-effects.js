import * as T from "three";
import { canvasTex } from "./model.js";

// Light the noise field from the upper left to give each billow a shaded underside.
function billowTexture() {
  const grid = Float32Array.from({ length: 4096 }, () => Math.random());
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const u = T.MathUtils.smoothstep(x - ix, 0, 1);
    const v = T.MathUtils.smoothstep(y - iy, 0, 1);
    const at = (i, j) => grid[(i & 63) + (j & 63) * 64];
    return T.MathUtils.lerp(T.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), u),
      T.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), u), v);
  }
  function density(x, y) {
    return 1 - Math.hypot(x, y) * 1.38 + 0.57 * (noise(3*x+7, 3*y+9)-0.5)
      + 0.28 * (noise(8*x, 8*y)-0.5) + 0.13 * (noise(23*x, 23*y)-0.5);
  }
  return canvasTex(160, 160, (c, w, h) => {
    const pixels = c.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = (i + 0.5) * 2 / w - 1, y = (j + 0.5) * 2 / h - 1;
      const d = density(x, y), facing = d - density(x - 0.065, y - 0.095);
      const shade = T.MathUtils.clamp(185 + facing * 260 - y * 20, 82, 250);
      const k = (j * w + i) * 4;
      pixels.data[k] = pixels.data[k+1] = pixels.data[k+2] = shade;
      pixels.data[k+3] = 255 * T.MathUtils.smoothstep(d, 0.02, 0.42);
    }
    c.putImageData(pixels, 0, 0);
  });
}

export function breachEffects(scene, x, z) {
  const root = new T.Group();
  root.position.set(x, 0, z);
  root.visible = false;
  scene.add(root);
  const map = billowTexture();
  const clouds = [];
  for (let i = 0; i < 39; i++) {
    const hot = i < 7, ground = i >= 18, landing = i >= 33;
    const angle = i * 2.39996, variation = Math.random();
    const sprite = new T.Sprite(new T.SpriteMaterial({
      map, transparent: true, depthWrite: false,
      blending: hot ? T.AdditiveBlending : T.NormalBlending,
    }));
    root.add(sprite);
    clouds.push({sprite, hot, ground, landing, angle, variation,
      start: landing ? [0.69, 0.82, 0.98][(i - 33) % 3] : hot ? i * 0.009 : ground ? 0.055 + variation * 0.17 : 0.04 + variation * 0.23,
      life: landing ? 0.80 + variation * 0.28 : hot ? 0.18 + variation * 0.12 : ground ? 1.4 + variation * 0.6 : 2.0 + variation * 0.65});
  }
  const chips = new T.InstancedMesh(new T.IcosahedronGeometry(1),
    new T.MeshStandardMaterial({color: 0x928b78, roughness: 1, flatShading: true}), 62);
  chips.frustumCulled = false;
  root.add(chips);
  const transform = new T.Object3D();
  const gravel = Array.from({length:chips.count}, (_, i) => ({
    x: (Math.random() - 0.5) * 2.3, z: Math.random() * 0.6 - 0.5, angle: i * 2.4,
    speed: 2.4 + Math.random() * 5.8, lift: 3 + Math.random() * 5.8, size: 0.045 + Math.random() * 0.091,
  }));
  return function update(t) {
    root.visible = t >= 0 && t < 3;
    if (!root.visible) return;
    for (const {sprite, hot, ground, landing, angle, variation, start, life} of clouds) {
      const age = t - start, u = age / life;
      sprite.visible = u >= 0 && u < 1;
      if (!sprite.visible) continue;
      const push = 1 - Math.exp(-age * (hot ? 12 : 3.5));
      const reach = hot ? 0.9 : ground ? 3.8 + variation : 1.4 + variation;
      sprite.position.set(Math.cos(angle) * (0.4 + push * reach),
        ground ? 0.19 + age * 0.23 : 0.49 + push * (0.45 + variation) + age * (hot ? 2.3 : 0.96),
        -1.05 + Math.sin(angle) * (0.18 + push * reach * 0.76));
      if (landing) {
        sprite.position.x = (Math.cos(angle) < 0 ? -1 : 1) * (4.8 + push * 0.95);
        sprite.position.z = Math.sin(angle) * 1.2;
      }
      const size = hot ? 1.25 + push * 2.35 : 1.1 + push * 1.65 + age * 0.9;
      sprite.scale.set(size * (ground ? 1.7 : 1), size * (ground ? 0.55 : 1), 1);
      sprite.material.rotation = (variation - 0.5) * 1.2 + age * Math.cos(angle) * 0.23;
      if (hot) sprite.material.color.setRGB(3.7 - 2.7 * u, 1.65 * (1-u)**2 + 0.12, 0.43 * (1-u)**4);
      else sprite.material.color.setHex(ground ? 0xd4c3a4 : variation < 0.48 ? 0x968a78 : 0xb2a796);
      sprite.material.opacity = (hot ? 0.81 : ground ? 0.65 : 0.83)
        * Math.min(1, (age + (hot ? 0.03 : 0)) / 0.065) * (1 - u) ** 1.35;
    }
    chips.visible = t < 1.6;
    if (!chips.visible) return;
    gravel.forEach((chip, i) => {
      const y = 0.64 + chip.lift * t - 9.8 * t*t;
      const push = chip.speed * (1 - Math.exp(-t * 1.25));
      transform.position.set(chip.x + Math.cos(chip.angle) * push, y, chip.z + Math.sin(chip.angle) * push);
      transform.rotation.set(t * chip.speed, chip.angle + t * 4, i);
      transform.scale.set(1.5, 0.73, 1).multiplyScalar(y > 0.04 ? chip.size : 0);
      transform.updateMatrix();
      chips.setMatrixAt(i, transform.matrix);
    });
    chips.instanceMatrix.needsUpdate = true;
  };
}
