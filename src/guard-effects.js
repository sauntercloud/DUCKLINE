import { heightAt } from "./terrain.js";
import * as T from "three";
import { canvasTex, random } from "./model.js";

const plume = canvasTex(96, 96, (c) => {
  c.translate(48, 48);
  c.rotate(0.52);
  c.fillStyle = "#dfd6bd";
  c.beginPath();
  c.moveTo(0, 43);
  c.bezierCurveTo(-31, 16, -13, -24, 4, -42);
  c.bezierCurveTo(22, -17, 22, 14, 0, 43);
  c.fill();
  c.strokeStyle = "#9a907a";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-2, 46);
  c.quadraticCurveTo(5, 6, 4, -36);
  c.stroke();
  for (let y = -23; y < 26; y += 7) {
    c.beginPath();
    c.moveTo(3, y + 8);
    c.lineTo(-10, y - 4);
    c.moveTo(3, y + 8);
    c.lineTo(13, y - 4);
    c.stroke();
  }
});
const dust = canvasTex(80, 80, (c) => {
  const g = c.createRadialGradient(40, 40, 2, 40, 40, 38);
  g.addColorStop(0, "rgba(195,184,157,.86)");
  g.addColorStop(0.45, "rgba(160,150,127,.50)");
  g.addColorStop(1, "rgba(143,134,110,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 80, 80);
});
export function guardParticles(scene, effects, point, dx, dz, landing = false) {
  const count = landing ? 9 : 5;
  for (let i = 0; i < count; i++) {
    const feather = !landing || i < 3,
      life = feather ? 0.55 + random() * 0.45 : 0.45 + random() * 0.26;
    const m = new T.SpriteMaterial({
      map: feather ? plume : dust,
      transparent: true,
      depthWrite: false,
      rotation: random() * 6.28,
    });
    const s = new T.Sprite(m);
    s.position.copy(point);
    const angle = random() * Math.PI * 2,
      rad = landing ? 0.46 : 0.1;
    s.position.x += Math.sin(angle) * rad;
    s.position.z += Math.cos(angle) * rad;
    const size = feather ? 0.13 + random() * 0.15 : 0.5 + random() * 0.35;
    s.scale.setScalar(size);
    scene.add(s);
    effects.push({
      object: s,
      ttl: life,
      life,
      particle: true,
      feather,
      spinRate: (random() - 0.5) * 9,
      vel: new T.Vector3(
        Math.sin(angle) * 1.1 + dx * 0.72,
        feather ? 1.3 + random() * 1.6 : 0.4,
        Math.cos(angle) * 1.1 + dz * 0.72,
      ),
    });
  }
}
export function tickGuardParticle(f, dt) {
  const s = f.object;
  s.position.addScaledVector(f.vel, dt);
  f.vel.multiplyScalar(Math.exp(-1.8 * dt));
  f.vel.y -= dt * (f.feather ? 4.4 : 0.15);
  s.position.y = Math.max(
    heightAt(s.position.x, s.position.z) + 0.065,
    s.position.y,
  );
  s.material.rotation += dt * f.spinRate;
  s.material.opacity = Math.min(1, Math.max(0, f.ttl / f.life) * 2.2);
  if (!f.feather) s.scale.multiplyScalar(1 + dt * 1.8);
}
export function guardMaterials(actor) {
  const copies = new Map();
  actor.root.traverse((o) => {
    if (!o.isMesh) return;
    if (!copies.has(o.material)) {
      const m = o.material.clone();
      m.alphaHash = true;
      m.emissive.setHex(0xff9955);
      m.emissiveIntensity = 0;
      copies.set(o.material, m);
    }
    o.material = copies.get(o.material);
  });
  return [...copies.values()];
}
