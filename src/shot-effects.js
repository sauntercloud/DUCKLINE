import * as T from "three";
import { canvasTex } from "./model.js";

// A luminous core with uneven lobes reads against both the yard and the dark receiver.
const flashMap = canvasTex(128, 128, (ctx) => {
  ctx.translate(64, 64);
  ctx.globalCompositeOperation = "lighter";
  for (const [angle, length, width] of [[0.2, 51, 13], [1.7, 42, 12], [3.1, 55, 16], [4.8, 36, 12], [0, 23, 23]]) {
    ctx.save();
    ctx.rotate(angle);
    ctx.scale(length, width);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, "#fffae5");
    g.addColorStop(0.26, "#ffdd8cf5");
    g.addColorStop(0.63, "#ff973489");
    g.addColorStop(1, "#ff701300");
    ctx.fillStyle = g;
    ctx.fillRect(-0.26, -1, 1.26, 2);
    ctx.restore();
  }
});

export function muzzleFlash() {
  return new T.Sprite(new T.SpriteMaterial({
    map: flashMap, color: new T.Color(2.3, 1.7, 0.95),
    depthWrite: false, blending: T.AdditiveBlending,
  }));
}

const vaporMap = canvasTex(96, 96, (ctx) => {
  for (let i = 0; i < 15; i++) {
    const a = i * 2.4, d = 20 * Math.sqrt(i / 15);
    const x = 48 + Math.cos(a) * d, y = 48 + Math.sin(a) * d;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
    g.addColorStop(0, "rgba(255,255,255,.36)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, y - 22, 44, 44);
  }
});

// Recycle the oldest wisp on sustained fire, keeping the draw-call count bounded.
export function shotVapor(scene) {
  const slots = [];
  let next = 0;
  return {
    emit(at, color, size, opacity, life, vx, vy, vz) {
      let slot = slots[next];
      if (!slot) {
        const sprite = new T.Sprite(new T.SpriteMaterial({
          map: vaporMap, transparent: true, depthWrite: false,
        }));
        scene.add(sprite);
        slot = slots[next] = { sprite, velocity: new T.Vector3() };
      }
      next = (next + 1) % 28;
      Object.assign(slot, { size, opacity, life, age: 0 });
      slot.velocity.set(vx, vy, vz);
      slot.sprite.visible = true;
      slot.sprite.position.copy(at);
      slot.sprite.material.color.setHex(color);
      slot.sprite.material.rotation = next * 2.4;
      slot.sprite.material.opacity = opacity;
      slot.sprite.scale.setScalar(size);
    },
    update(dt) {
      for (const slot of slots) {
        const s = slot.sprite;
        if (!s.visible) continue;
        slot.age += dt;
        const t = Math.min(1, slot.age / slot.life);
        s.position.addScaledVector(slot.velocity, dt);
        s.material.rotation += dt * 0.65;
        s.scale.setScalar(slot.size * (1 + t * 2));
        s.material.opacity = slot.opacity * (1 - t) ** 1.4;
        s.visible = t < 1;
      }
    },
    clear() {
      for (const slot of slots) slot.sprite.visible = false;
    },
  };
}
