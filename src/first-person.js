import * as T from "three";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { muzzleFlash } from "./shot-effects.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { batch, box, canvasTex, cylinder, group, mat, mesh, oval } from "./model.js";

const graphite = mat(0x252d30, 0.56, 0.37),
  steel = mat(0x627072, 0.65, 0.33),
  canvas = mat(0x495244, 0, 0.92),
  binding = mat(0x303931, 0, 0.82),
  feather = mat(0xf0dfb7, 0, 0.86),
  amber = mat(0xd99b4c, 0.18, 0.57);

function bevel(parent, x, y, z, w, h, d, radius, material) {
  return mesh(parent, new RoundedBoxGeometry(w, h, d, 2, radius), material, x, y, z);
}

// The wing is folded around the grip. Its sleeve runs out of frame
// toward the right shoulder and shares the weapon's recoil and reload pose.
function rightWing(parent, gripZ) {
  const hand = group(parent, 0, -0.14, gripZ);
  oval(hand, -0.043, -0.018, -0.035, 0.075, 0.086, 0.103, feather);
  oval(hand, 0.029, -0.018, 0.021, 0.036, 0.074, 0.065, feather);
  for (let i = 0; i < 3; i++) {
    const tip = oval(hand, 0.009, 0.029 - i * 0.039, 0.034 - i * 0.009,
      0.060 - i * 0.005, 0.026, 0.052, feather);
    tip.rotation.y = -0.35;
    tip.rotation.z = 0.13;
  }
  const sleeve = group(hand, -0.061, -0.042, -0.085);
  sleeve.rotation.set(-0.62, 0.52, 0, "YXZ");
  // Sleeve local +Z points out of the cuff toward the folded feathers.
  const fabric = cylinder(sleeve, 0, 0, -0.26, 0.092, 0.16, 0.53, canvas, 20);
  fabric.rotation.x = Math.PI / 2;
  const cuff = cylinder(sleeve, 0, 0, -0.025, 0.096, 0.104, 0.060, binding, 20);
  cuff.rotation.x = Math.PI / 2;
}

function closeUpDetails(weapon, pistol) {
  const trim = group(weapon);
  if (pistol) {
    bevel(trim, 0, 0.038, 0.109, 0.139, 0.087, 0.43, 0.014, graphite);
    for (let i = 0; i < 5; i++)
      box(trim, 0, 0.04, -0.078 + i * 0.014, 0.142, 0.054, 0.006, steel);
    for (const x of [-0.041, 0.041])
      box(trim, x, 0.093, -0.071, 0.025, 0.025, 0.042, graphite);
    box(trim, 0, 0.093, 0.278, 0.015, 0.026, 0.032, amber);
    rightWing(trim, -0.017);
  } else {
    bevel(trim, 0, 0.027, -0.006, 0.148, 0.152, 0.54, 0.016, graphite);
    bevel(trim, 0, 0.041, -0.38, 0.145, 0.088, 0.238, 0.024, canvas);
    for (let i = 0; i < 15; i++)
      box(trim, 0, 0.14, -0.239 + i * 0.035, 0.115, 0.014, 0.02, graphite);
    bevel(trim, 0.073, 0.043, 0.044, 0.009, 0.049, 0.159, 0.004, steel);
    box(trim, 0.079, 0.044, 0.047, 0.006, 0.023, 0.116, graphite);
    for (const x of [-0.033, 0.033])
      box(trim, x, 0.241, -0.068, 0.019, 0.034, 0.082, steel);
    box(trim, 0, 0.218, 0.49, 0.018, 0.016, 0.026, amber);
    const collar = cylinder(trim, 0, 0.045, 0.747, 0.039, 0.039, 0.072, graphite);
    collar.rotation.x = Math.PI / 2;
    rightWing(trim, -0.088);
  }
  const stamp = canvasTex(256, 48, (ctx) => {
    ctx.fillStyle = "#d2cbbb";
    ctx.font = "bold 37px monospace";
    ctx.fillText(pistol ? "P–09" : "AR–04", 10, 38);
    ctx.fillStyle = "#d99b4c";
    for (let i = 0; i < 3; i++) ctx.fillRect(160 + i * 14, 9, 7, 28);
  });
  const marking = mesh(trim, new T.PlaneGeometry(pistol ? 0.134 : 0.18, pistol ? 0.025 : 0.034),
    new T.MeshStandardMaterial({ map: stamp, alphaTest: 0.4, roughness: 0.7 }),
    pistol ? 0.071 : 0.075, pistol ? 0.045 : -0.018, pistol ? 0.072 : -0.094);
  marking.rotation.y = Math.PI / 2;
  batch(trim);
}

export function firstPersonEquipment(player, environment) {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(67, 1, 0.025, 8);
  scene.environment = environment;
  scene.environmentIntensity = 0.72;
  scene.add(new T.HemisphereLight(0xf4eedf, 0x73807b, 1.35));
  const key = new T.DirectionalLight(0xffdcab, 2.3);
  key.position.set(-3, 4, 2);
  scene.add(key);
  const rig = group(scene);
  const sightPoint = new T.Vector3();
  const pivots = [];

  const pairs = [];
  const weapons = [player.gun, player.pistol].map((source, index) => {
    const copy = source.clone();
    const parts = [];
    source.traverse((part) => parts.push(part));
    let i = 0;
    copy.traverse((part) => pairs.push([parts[i++], part]));
    // Put the pivot on the bore axis in the resting pose. Recoil and reload
    // are still relative to this pose and carry both the wing and the muzzle.
    const pivot = group(rig, 0, 0, index === 1 ? 0.19 : 0);
    pivots.push(pivot);
    const bore = group(pivot, 0, -0.045 * source.scale.y, 0);
    bore.quaternion.copy(source.quaternion).invert();
    const mount = group(bore);
    mount.position.copy(source.position).negate();
    mount.add(copy);
    closeUpDetails(copy, index === 1);
    return copy;
  });
  const flare = muzzleFlash();
  flare.visible = false;
  let flashAge = Infinity;
  const pass = new RenderPass(scene, camera);
  pass.clear = false;
  pass.clearDepth = true;
  pass.enabled = false;
  return {
    pass,
    resize(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    flash(weapon) {
      weapons[weapon].add(flare);
      flare.position.set(0, 0.045, weapon ? 0.36 : 0.82);
      flare.scale.setScalar(weapon ? 0.16 : 0.24);
      flare.material.rotation = Math.random() * Math.PI;
      flare.material.opacity = 1;
      flashAge = -1;
      flare.visible = true;
    },
    clearFlash() {
      flare.visible = false;
      flashAge = Infinity;
    },
    update(dt, depth) {
      sightPoint.set(0, 0, -depth);
      // Pull the equipment back proportionally against very near cover so
      // the muzzle stays between the eye and the point under the reticle.
      rig.scale.setScalar(Math.min(1, Math.max(0.01, depth) / 2.6));
      const scale = rig.scale.x;
      rig.position.set(Math.min(0.38, camera.aspect * 0.23) * scale, -0.31 * scale, -1.04 * scale);
      for (const pivot of pivots) pivot.lookAt(sightPoint);
      flashAge = flashAge < 0 ? 0 : flashAge + dt;
      flare.visible = flashAge < 0.052;
      flare.material.opacity = Math.max(0, 1 - flashAge / 0.052);
      for (const [source, copy] of pairs) {
        copy.position.copy(source.position);
        copy.quaternion.copy(source.quaternion);
        copy.scale.copy(source.scale);
        copy.visible = source.visible;
      }
    },
    muzzle(weapon, worldCamera) {
      const tip = weapons[weapon].localToWorld(
        new T.Vector3(0, 0.045, weapon ? 0.32 : 0.78),
      );
      return worldCamera.localToWorld(tip);
    },
  };
}
