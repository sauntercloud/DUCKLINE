import "./style.css";
import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { circuits, arrivals, createNavigation } from "./patrol.js";
import {
  guardParticles,
  guardMaterials,
  tickGuardParticle,
} from "./guard-effects.js";
import { heightAt, groundRange } from "./terrain.js";
import { poseDuck, poseLoadout, magRelease, magSeat } from "./animation.js";
import { createSound } from "./sound.js";
import { barrelFire, harborSky } from "./atmosphere.js";
import { duck, canvasTex, random } from "./model.js";
import { breachEffects } from "./breach-effects.js";
import { muzzleFlash, shotVapor } from "./shot-effects.js";
import { firstPersonEquipment } from "./first-person.js";
import { bindCameraInput } from "./camera-input.js";
import { bindDrag } from "./touch-controls.js";
import { yard, districts } from "./yard-layout.js";
import {
  createWorld,
  extractionRange,
  cameraLift,
  blocked,
  obstacles,
  supply,
  breach,
  roadExit,
  gapHalf,
  lots,
} from "./world.js";
import { $, icon, initUI } from "./ui.js";

initUI();
const canvas = $("world"),
  viewport = $("game");
const scene = new T.Scene();
scene.background = new T.Color(0x878a7e);
scene.fog = new T.FogExp2(0xa0a398, 0.009);
const renderer = new T.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;
const camera = new T.PerspectiveCamera(36, 1, 0.15, 120);
const pmrem = new T.PMREMGenerator(renderer),
  studio = new RoomEnvironment(),
  env = pmrem.fromScene(studio, 0.04);
scene.environment = env.texture;
scene.environmentIntensity = 0.37;
studio.dispose();
pmrem.dispose();
scene.add(new T.HemisphereLight(0xbacfe4, 0x615849, 0.88));
const sun = new T.DirectionalLight(0xffd197, 3.1);
sun.position.set(-19, 13, -9);
sun.target.position.set(0, 0, -1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -27,
  right: 27,
  top: 27,
  bottom: -27,
  near: 0.4,
  far: 65,
});
sun.shadow.normalBias = 0.026;
sun.shadow.bias = -0.00024;
scene.add(sun, sun.target);
const world = createWorld(scene);
harborSky(scene);
const fire = barrelFire(scene, 5.8, -3.85);
const occlusion = {
  center: { value: new T.Vector2(0.5, 0.5) },
  aspect: { value: 1 },
  depth: { value: 20 },
};
world.solid.traverse((o) => {
  if (!o.isMesh || o.material.userData.cutaway) return;
  const m = o.material;
  m.userData.cutaway = true;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.playerCenter = occlusion.center;
    shader.uniforms.viewAspect = occlusion.aspect;
    shader.uniforms.playerDepth = occlusion.depth;
    shader.vertexShader =
      "varying vec4 coverClip;\n" +
      shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n coverClip=gl_Position;",
      );
    shader.fragmentShader =
      "varying vec4 coverClip;uniform vec2 playerCenter;uniform float viewAspect;uniform float playerDepth;\n" +
      shader.fragmentShader.replace(
        "#include <alphatest_fragment>",
        `#include <alphatest_fragment>
  vec2 delta=(coverClip.xy/coverClip.w*.5+.5-playerCenter)*vec2(viewAspect,1.);
  float gap=playerDepth-coverClip.w;float cutout=(1.-smoothstep(.097,.165,length(delta)))*smoothstep(.42,.95,gap);
  if(cutout>.001&&fract(dot(gl_FragCoord.xy,vec2(.75487766,.56984029)))<cutout*.98)discard;`,
      );
  };
});
const player = duck(scene);
player.root.scale.setScalar(1.14);
const camOffset = new T.Vector3(8.7, 9.6, 16.6),
  focus = new T.Vector3(),
  v3 = new T.Vector3();
const portraitScene = new T.Scene();
portraitScene.environment = scene.environment;
portraitScene.environmentIntensity = 0.55;
portraitScene.background = new T.Color(0x51594c);
const portraitDuck = player.body.clone(true);
portraitScene.add(portraitDuck);
portraitDuck.rotation.y = 0.25;
portraitScene.add(new T.HemisphereLight(0xf9e7c7, 0x7a8377, 1.8));
const portraitLight = new T.DirectionalLight(0xffdfac, 3);
portraitLight.position.set(-3, 4, 3);
portraitScene.add(portraitLight);
const portraitCam = new T.PerspectiveCamera(28, 1, 0.1, 9);
portraitCam.position.set(1.05, 2.05, 2.35);
portraitCam.lookAt(0, 1.51, 0.02);
renderer.setSize(144, 144, false);
renderer.render(portraitScene, portraitCam);
$("portrait").src = canvas.toDataURL();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const equipment = firstPersonEquipment(player, scene.environment);
composer.addPass(equipment.pass);
let firstPerson = false,
  lookPitch = 0,
  targetLookPitch = 0;
const lookDirection = new T.Vector3();
const bloom = new UnrealBloomPass(new T.Vector2(800, 500), 0.22, 0.55, 1.18);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const antialias = new ShaderPass(FXAAShader);
composer.addPass(antialias);
const glowTex = canvasTex(80, 80, (c) => {
  let g = c.createRadialGradient(40, 40, 0, 40, 40, 39);
  g.addColorStop(0, "rgba(255,223,152,1)");
  g.addColorStop(0.08, "rgba(255,198,94,.72)");
  g.addColorStop(0.29, "rgba(255,176,78,.19)");
  g.addColorStop(1, "rgba(255,150,68,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 80, 80);
});
for (const p of world.lampPositions) {
  const s = new T.Sprite(
    new T.SpriteMaterial({
      map: glowTex,
      color: 0xffd8a1,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  s.position.set(...p);
  s.position.y -= 0.1;
  s.scale.set(1.9, 1.9, 1);
  scene.add(s);
}
const dustCoords = new Float32Array(220 * 3);
for (let n = 0; n < dustCoords.length; n += 3) {
  dustCoords[n] = random() * 45 - 22.5;
  dustCoords[n + 1] = random() * 6;
  dustCoords[n + 2] = random() * 48 - 25;
}
const dustGeo = new T.BufferGeometry();
dustGeo.setAttribute("position", new T.BufferAttribute(dustCoords, 3));
const dust = new T.Points(
  dustGeo,
  new T.PointsMaterial({
    color: 0xffdda2,
    size: 0.033,
    transparent: true,
    opacity: 0.43,
    map: glowTex,
    depthWrite: false,
  }),
);
scene.add(dust);
let settings = {};
try {
  settings = JSON.parse(localStorage.getItem("duckline-settings")) ?? {};
} catch {
  // Local files can run with browser storage disabled.
}
let quality = settings.quality || "auto",
  sound = settings.sound !== false;
let renderScale = 1;
function resize() {
  const w = viewport.clientWidth,
    h = viewport.clientHeight;
  const ratio =
    quality === "4k"
      ? Math.min(3840 / w, 2160 / h)
      : quality === "balanced"
        ? Math.min(devicePixelRatio, 1)
        : Math.min(
            devicePixelRatio,
            matchMedia("(pointer:coarse)").matches ? 1.25 : 1.65,
          ) * renderScale;
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(ratio);
  composer.setSize(w, h);
  antialias.material.uniforms.resolution.value.set(
    1 / (w * ratio),
    1 / (h * ratio),
  );
  camera.aspect = w / h;
  camera.fov = firstPerson ? 67 : w / h < 1 ? 47 : 36;
  equipment.resize(w / h);
  camera.updateProjectionMatrix();
  world.wet.visible = quality !== "balanced";
  bloom.enabled = quality !== "balanced";
  $("qualityTag").textContent =
    quality === "4k" ? "4K UHD" : quality === "balanced" ? "BALANCED" : "ULTRA";
}
window.addEventListener("resize", resize);
document.addEventListener("fullscreenchange", resize);
resize();
const mixer = createSound(),
  tone = mixer.tone;
let volume = Number.isFinite(settings.volume)
  ? T.MathUtils.clamp(settings.volume, 0, 1)
  : 0.72;
document.addEventListener("pointerup", async function enterMobileGame(e) {
  if (e.pointerType !== "touch" || !$("loading").hidden || screen) return;
  if (!viewport.contains(e.target) && e.target !== $("perspective")) return;
  document.removeEventListener("pointerup", enterMobileGame);
  const orientation = window.screen.orientation;
  try {
    if (!orientation?.lock) throw new Error("Orientation lock unavailable");
    if (document.fullscreenEnabled && !document.fullscreenElement)
      await document.documentElement.requestFullscreen();
    await orientation.lock("landscape");
  } catch {
    if (matchMedia("(orientation: portrait)").matches)
      toast("请将手机横过来，或继续竖屏游玩");
  }
});
window.addEventListener("keydown", mixer.unlock, true);
window.addEventListener("pointerdown", mixer.unlock, true);
function spatialSound(kind, point, gain = 1) {
  const dx = point.x - player.root.position.x,
    dz = point.z - player.root.position.z;
  const distance = Math.hypot(dx, dz),
    pan = (dx * right.x + dz * right.z) / Math.max(2, distance);
  mixer.play(kind, { pan, distance, gain });
}
function saveSettings() {
  mixer.configure(sound, volume);
  try {
    localStorage.setItem(
      "duckline-settings",
      JSON.stringify({ sound, quality, volume }),
    );
  } catch {
    // Keep settings for this session if the browser disallows persistence.
  }
  $("sound").innerHTML = icon(sound ? "sound" : "mute");
  $("sound").setAttribute("aria-pressed", String(sound));
}
saveSettings();
const findPath = createNavigation(blocked);
const enemies = circuits.map((route, i) => {
  const actor = duck(scene, true);
  return {
    actor,
    route,
    materials: guardMaterials(actor),
    phase: i * 1.6,
    lastSeen: new T.Vector3(),
  };
});
const reinforcementInterval = 22;
let reinforcementTime = reinforcementInterval;
function deployGuard(e, point = e.route[0]) {
  const [x, z] = point;
  Object.assign(e, {
    hp: 3,
    cd: 0.65 + random() * 0.35,
    flinch: 0,
    fall: 0,
    deadTime: 0,
    back: 0,
    side: 0,
    waypoint: point === e.route[0] ? 1 : 0,
    path: [],
    destination: "",
    alert: 0,
    notice: 0,
    engaged: false,
    burst: 0,
    kick: 0,
    strafe: 1,
    strafeTime: 0.9 + random(),
    knockX: 0,
    knockZ: 0,
    scanTime: 0.3,
  });
  const actor = e.actor;
  actor.root.visible = true;
  actor.root.position.set(x, heightAt(x, z), z);
  actor.root.rotation.set(0, e.phase, 0, "YXZ");
  actor.root.scale.setScalar(1);
  Object.assign(actor.motion, {
    phase: e.phase,
    speed: 0,
    twist: 0,
    search: 0,
    extract: 0,
    heading: e.phase,
  });
  actor.gun.position.z = 0.58;
  actor.gun.rotation.set(0.045, 0, 0);
  poseDuck(actor, 0.016, e.phase, 0, 0);
  for (const m of e.materials) {
    m.opacity = 1;
    m.emissiveIntensity = 0;
  }
}
const state = {};
let screen = "",
  held = false,
  started = false,
  elapsed = 0,
  fireCD = 0,
  reloadTime = 0,
  recoil = 0,
  playerMotion = 0,
  toastTime = 0,
  joystickX = 0,
  joystickY = 0;
const keys = new Set(),
  pointer = new T.Vector2(),
  ray = new T.Raycaster(),
  aim = new T.Vector3();
let aiming = false;
const stats = [
  {
    name: "AR–04",
    action: "全自动",
    cap: 30,
    delay: 0.115,
    reload: 1.45,
    driftStep: T.MathUtils.degToRad(0.16),
    settle: 0.32,
    maxDrift: T.MathUtils.degToRad(2.3),
  },
  {
    name: "P–09",
    action: "半自动",
    cap: 12,
    delay: 0.28,
    reload: 0.9,
    driftStep: T.MathUtils.degToRad(0.26),
    settle: 0.4,
    maxDrift: T.MathUtils.degToRad(1.6),
  },
];
const shotDrift = [0, 0];
const shotTime = [-Infinity, -Infinity];
const defaultYaw = Math.atan2(camOffset.x, camOffset.z),
  defaultRadius = camOffset.length(),
  defaultPitch = Math.asin(camOffset.y / defaultRadius);
let pitch = defaultPitch,
  targetPitch = pitch,
  radius = defaultRadius,
  targetRadius = radius,
  lift = 0;
let yaw = defaultYaw,
  targetYaw = defaultYaw,
  action = null;
const objectiveMarker = makeMarker("box");
const chevron = document.createElement("i");
chevron.className = "player-pointer";
$("markers").append(chevron);
function makeMarker(name) {
  const e = document.createElement("div");
  e.className = "marker " + name;
  e.innerHTML = "<i>" + icon(name) + "</i><small></small>";
  $("markers").append(e);
  return e;
}
const threats = new Map();
const threatPoint = new T.Vector3();
const threatLifetime = 1.8;

function markThreat(attacker) {
  let threat = threats.get(attacker);
  if (!threat) {
    const arrow = document.createElement("i");
    arrow.className = "threat-arrow";
    arrow.setAttribute("aria-hidden", "true");
    $("markers").append(arrow);
    threat = { arrow, source: new T.Vector3(), expires: 0 };
    threats.set(attacker, threat);
  }
  threat.source.copy(attacker.actor.root.position);
  threat.expires = elapsed + threatLifetime;
}

function updateThreats() {
  if (!threats.size) return;
  const p = player.root.position;
  const center = occlusion.center.value;
  for (const [attacker, threat] of threats) {
    const remaining = threat.expires - elapsed;
    if (remaining <= 0) {
      threat.arrow.remove();
      threats.delete(attacker);
      continue;
    }
    // Project a short step toward the firing position at the HUD anchor's height.
    threatPoint.subVectors(threat.source, p).setY(0).normalize();
    let dx, up;
    if (firstPerson) {
      dx = threatPoint.dot(right);
      up = threatPoint.dot(forward);
    } else {
      threatPoint.add(p);
      threatPoint.y = p.y + 1.22;
      threatPoint.project(camera);
      dx = (threatPoint.x * 0.5 + 0.5 - center.x) * camera.aspect;
      up = threatPoint.y * 0.5 + 0.5 - center.y;
    }
    const style = threat.arrow.style;
    style.left = center.x * 100 + "%";
    style.top = (1 - center.y) * 100 + "%";
    style.transform =
      "translate(-50%, -50%) rotate(" +
      Math.atan2(dx, up) +
      "rad) translateY(calc(-1 * var(--threat-radius)))";
    style.opacity = Math.min(1, remaining / 0.55);
  }
}

function reset() {
  if (firstPerson) setPerspective(false);
  for (const { arrow } of threats.values()) arrow.remove();
  threats.clear();
  Object.assign(state, {
    hp: 100,
    stamina: 100,
    weapon: 0,
    ammo: [30, 12],
    reserve: [120, 48],
    meds: 2,
    phase: "supply",
    time: 900,
    kills: 0,
    fuse: 0,
    blastAge: 0,
    result: "",
  });
  started = false;
  routeGuide.goal = null;
  world.updateBreach(state.phase, 0);
  $("iris").hidden = true;
  clearAction();
  shotDrift.fill(0);
  shotTime.fill(-Infinity);
  playerMotion = 0;
  yaw = targetYaw = defaultYaw;
  pitch = targetPitch = defaultPitch;
  radius = targetRadius = defaultRadius;
  lift = 0;
  updateOrbit(0);
  $("crosshair").classList.remove("hit", "down");
  held = false;
  aiming = false;
  reloadTime = 0;
  fireCD = 0;
  recoil = 0;
  for (const actor of [player, ...enemies.map((e) => e.actor)]) {
    Object.assign(actor.motion, { speed: 0, twist: 0, search: 0, extract: 0 });
  }
  keys.clear();
  $("hint").textContent = "";
  $("toast").textContent = "";
  for (const fx of effects) fxRemove(fx);
  effects.length = 0;
  vapor.clear();
  showBreachEffects(-1);
  equipment.clearFlash();
  muzzleLight.intensity = 0;
  player.root.position.set(-0.7, 0, 1);
  player.root.rotation.y = 0.89;
  player.root.visible = true;
  focus.copy(player.root.position);
  focus.y = 1.35;
  camera.position.copy(focus).add(camOffset);
  camera.lookAt(focus);
  reinforcementTime = reinforcementInterval;
  enemies.forEach((e) => deployGuard(e));
  updateHud();
  closeModal();
}
function updateHud() {
  const w = state.weapon;
  $("hp").textContent = Math.ceil(state.hp);
  $("hpbar").style.width = state.hp + "%";
  $("stbar").style.width = state.stamina + "%";
  const carrying = state.phase === "carry";
  $("t1").classList.toggle("done", state.phase !== "supply");
  const critical = state.hp > 0 && state.hp < 100 / 3;
  viewport.classList.toggle("critical", critical);
  viewport.style.setProperty("--breath", (1.05 + state.hp / 33.34 * 0.9) + "s");
  $("ammo").textContent = String(state.ammo[w]).padStart(2, "0");
  $("reserve").textContent = state.reserve[w];
  $("ammoGauge").style.setProperty("--rounds", stats[w].cap);
  $("ammoGauge").style.setProperty("--fill", state.ammo[w] / stats[w].cap * 100 + "%");
  $("medcount").textContent = "×" + state.meds;
  $("cargoTask").textContent = state.phase === "supply" ? "去北坡哨营取爆破包" :
    carrying ? "爆破包已携带" : "爆破包已放置";
  $("gateTask").textContent = state.phase === "open" ? "穿过缺口，走上公路" :
    state.phase === "armed" ? "爆破倒计时 · " + Math.ceil(state.fuse) + " s" : "炸开南侧路障";
  $("gunName").textContent = stats[w].name;
  $("modeName").textContent = reloadTime > 0 ? "换弹中" : stats[w].action;
  document
    .querySelectorAll(".slot")
    .forEach((b, i) => b.classList.toggle("active", i === w));
  player.gun.visible = w === 0;
  player.pistol.visible = w === 1;
}
function toast(msg) {
  $("toast").textContent = msg;
  toastTime = 2.0;
}
function equip(i) {
  if (screen) return;
  if (i === 3) {
    openModal("bag");
    return;
  }
  if (i === 2) {
    heal();
    return;
  }
  state.weapon = i;
  reloadTime = 0;
  held = false;
  tone(420, 0.04, "triangle", 0.025);
  updateHud();
}
function heal() {
  if (!state.meds) {
    toast("医疗包已用完");
    return;
  }
  if (state.hp >= 100) {
    toast("生命值已满");
    return;
  }
  state.meds--;
  state.hp = Math.min(100, state.hp + 48);
  tone(550, 0.2, "sine", 0.07, 1.4);
  toast("已使用医疗包");
  updateHud();
}
function reload() {
  const w = state.weapon;
  if (!reloadTime && state.ammo[w] < stats[w].cap && state.reserve[w] > 0) {
    reloadTime = stats[w].reload;
    updateHud();
  } else if (!state.reserve[w]) toast("备用弹药已用完");
}
const pickupRange = 2.55;
function currentGoal() {
  if (state.phase === "supply") return supply;
  return state.phase === "open" ? roadExit : breach;
}
function nearbyAction() {
  const p = player.root.position;
  if (state.phase === "supply" && dist(p, ...supply) < pickupRange)
    return { label: "拾取爆破包", duration: 1.1, point: supply };
  if (state.phase === "carry" && dist(p, ...breach) < extractionRange)
    return { label: "放置爆破包", duration: 1.6, point: breach };
  return null;
}
function clearAction() {
  action = null;
  $("actionProgress").hidden = true;
  $("hint").hidden = false;
}
function interruptAction() {
  if (!action) return;
  const label = action.label;
  clearAction();
  toast(label + "已中断");
}
function interact() {
  if (screen || action) return;
  const next = nearbyAction();
  if (!next) {
    toast({ supply: "去北坡哨营取爆破包", carry: "靠近南侧碎石路障", armed: "后退，等待爆破", open: "穿过缺口，沿路走出货场" }[state.phase]);
    return;
  }
  started = true;
  action = { ...next, elapsed: 0 };
  $("actionName").textContent = next.label;
  $("actionBar").value = 0;
  $("actionPercent").textContent = "0%";
  $("actionProgress").hidden = false;
  $("hint").hidden = true;
  mixer.play("latch", { gain: 0.18 });
}
function tickAction(dt) {
  if (!action) return;
  if (nearbyAction()?.point !== action.point) {
    interruptAction();
    return;
  }
  action.elapsed += dt;
  const fraction = Math.min(1, action.elapsed / action.duration);
  $("actionBar").value = fraction;
  $("actionPercent").textContent = Math.floor(fraction * 100) + "%";
  if (fraction < 1) return;
  clearAction();
  if (state.phase === "supply") {
    state.phase = "carry";
    toast("已取得爆破包 · 前往南侧路障");
    mixer.play("latch");
  } else {
    state.phase = "armed";
    state.fuse = 3;
    tone(720, 0.1);
    toast("爆破包已放置 · 后退");
  }
  world.updateBreach(state.phase, 0);
  updateHud();
}
const dist = (p, x, z) => Math.hypot(p.x - x, p.z - z);
function move(p, dx, dz) {
  if (!blocked(p.x + dx, p.z)) p.x += dx;
  if (!blocked(p.x, p.z + dz)) p.z += dz;
  p.y = heightAt(p.x, p.z);
}
// Distance along a ray to the first solid footprint, using two-dimensional slab intersections.
function wallRange(x, z, dx, dz, max, contact = null, y = null, slope = 0) {
  let nearest = max;
  for (const o of obstacles) {
    if (o.disabled) continue;
    let entry = 0,
      leave = nearest;
    for (const [origin, dir, center, half] of [
      [x, dx, o.x, o.w / 2],
      [z, dz, o.z, o.d / 2],
    ]) {
      if (Math.abs(dir) < 1e-7) {
        if (Math.abs(origin - center) > half) {
          leave = -1;
          break;
        }
        continue;
      }
      const a = (center - half - origin) / dir,
        b = (center + half - origin) / dir;
      entry = Math.max(entry, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
    }
    if (y !== null) {
      if (slope > 0) leave = Math.min(leave, (o.top - y) / slope);
      else if (slope < 0) entry = Math.max(entry, (o.top - y) / slope);
      else if (y > o.top) continue;
    }
    if (entry <= leave) {
      nearest = entry;
      if (contact) contact.kind = o.material;
    }
  }
  return nearest;
}
const effects = [],
  tracerGeo = new T.CylinderGeometry(1, 1, 1, 5),
  sparkGeo = new T.SphereGeometry(1, 5, 4),
  fxMat = new T.MeshBasicMaterial({ color: new T.Color(3.4, 1.8, 0.42) }),
  redMat = new T.MeshBasicMaterial({ color: new T.Color(2.7, 0.53, 0.22) });
const brass = new T.MeshStandardMaterial({
  color: 0xc7a961,
  metalness: 0.79,
  roughness: 0.34,
});
const vapor = shotVapor(scene);
const showBreachEffects = breachEffects(scene, breach[0], yard.south);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const blastCenter = new T.Vector3(breach[0], 0.76, yard.south - 1.12);
const muzzleLight = new T.PointLight(0xffc176, 0, 4);
scene.add(muzzleLight);
function shotEffects(muzzle, angle, viewWeapon = null) {
  if (viewWeapon !== null) equipment.flash(viewWeapon);
  else {
    const glow = muzzleFlash();
    glow.material.rotation = Math.random() * Math.PI;
    glow.position.copy(muzzle);
    glow.scale.setScalar(0.78);
    scene.add(glow);
    effects.push({ object: glow, ttl: 0.044, flash: true, fresh: true });
  }
  vapor.emit(muzzle, 0xc7c1b3, 0.19, 0.31, 0.42,
    Math.sin(angle) * 0.74 + 0.14, 0.49, Math.cos(angle) * 0.74);
  muzzleLight.position.copy(muzzle);
  muzzleLight.intensity = 17;
  const casing = new T.Mesh(tracerGeo, brass);
  casing.position.copy(muzzle);
  casing.position.x -= Math.sin(angle) * 0.5;
  casing.position.z -= Math.cos(angle) * 0.5;
  casing.rotation.z = 1;
  casing.scale.set(0.024, 0.084, 0.024);
  scene.add(casing);
  effects.push({
    object: casing,
    ttl: 0.72,
    spin: true,
    vel: new T.Vector3(Math.cos(angle) * 1.7, 1.65, -Math.sin(angle) * 1.7),
  });
}
function fxRemove(f) {
  scene.remove(f.object);
  if (f.particle || f.flash) f.object.material.dispose();
  if (f.tracer) world.invalidateReflection();
}
function tracer(from, to, hostile = false) {
  const vec = to.clone().sub(from),
    o = new T.Mesh(tracerGeo, hostile ? redMat : fxMat);
  const distance = vec.length();
  const length = Math.min(distance * 0.8, hostile ? 3.6 : 4.8);
  o.scale.set(0.016, length, 0.016);
  o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vec.normalize());
  scene.add(o);
  o.position.copy(from).addScaledVector(vec, length * 0.5);
  effects.push({ object: o, ttl: 0.076, tracer: true, fresh: true, from,
    direction: vec, travel: distance - length });
  world.invalidateReflection();
}
const debrisMaterials = {
  wood: new T.MeshStandardMaterial({ color: 0xb79360 }),
  stone: new T.MeshStandardMaterial({ color: 0x918d81 }),
  armor: new T.MeshStandardMaterial({ color: 0x9b927a }),
  metal: fxMat,
};
function impact(point, kind, dx, dz) {
  const metallic = kind === "metal";
  if (kind !== "armor") {
    const wood = kind === "wood";
    vapor.emit(point, metallic ? 0xa9ada7 : wood ? 0xbf976c : 0xb4aa95,
      metallic ? 0.13 : 0.34, metallic ? 0.26 : 0.64, metallic ? 0.29 : 0.58,
      -dx * 0.6 + 0.1, 0.52, -dz * 0.6);
  }
  for (let i = 0; i < (metallic ? 8 : 5); i++) {
    const chip = new T.Mesh(sparkGeo, debrisMaterials[kind]);
    chip.position.copy(point);
    chip.scale.set(0.021, 0.033, 0.021).multiplyScalar(0.65 + random() * 1.1);
    const vel = new T.Vector3(
      (random() - 0.5) * 2 - dx * 0.8,
      random() * 2 + 0.6,
      (random() - 0.5) * 2 - dz * 0.8,
    );
    if (metallic) chip.scale.y *= 4.7;
    else if (kind === "wood") chip.scale.set(0.017, 0.086, 0.013);
    chip.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      vel.clone().normalize(),
    );
    scene.add(chip);
    effects.push({ object: chip, ttl: 0.14 + random() * 0.19, vel });
  }
  spatialSound(kind, point, kind === "armor" ? 0.9 : 0.58);
}
function driftFor(w) {
  const spec = stats[w];
  // Carry the offset between consecutive shots, then ease it out during a pause.
  const recoveryStart = spec.delay + 0.05;
  const recovery = T.MathUtils.smoothstep(
    elapsed - shotTime[w],
    recoveryStart,
    spec.settle,
  );
  return shotDrift[w] * (1 - recovery);
}
function traceShot(origin, dx, dz, slope, maxRange, contact = {}) {
  let range = wallRange(
      origin.x,
      origin.z,
      dx,
      dz,
      maxRange,
      contact,
      origin.y,
      slope,
    ),
    hit = null;
  const terrainLimit = groundRange(
    origin.x,
    origin.y,
    origin.z,
    dx,
    slope,
    dz,
    range,
  );
  if (terrainLimit < range) {
    range = terrainLimit;
    contact.kind = "stone";
  }
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const ep = e.actor.root.position,
      vx = ep.x - origin.x,
      vz = ep.z - origin.z;
    const along = vx * dx + vz * dz,
      across = vx * dz - vz * dx;
    if (along <= 0 || Math.abs(across) > 0.55) continue;
    const near = Math.max(0, along - Math.sqrt(0.55 * 0.55 - across * across));
    const shotY = origin.y + slope * near;
    if (near < range && shotY >= ep.y && shotY <= ep.y + 2.14) {
      range = near;
      hit = e;
    }
  }
  return { range, hit };
}
function centerAimDepth() {
  camera.getWorldDirection(lookDirection);
  const horizontal = Math.hypot(lookDirection.x, lookDirection.z);
  const { range } = traceShot(camera.position, lookDirection.x / horizontal,
    lookDirection.z / horizontal, lookDirection.y / horizontal, 28);
  return range / horizontal;
}
function shoot() {
  if (screen || reloadTime || fireCD > 0) return;
  const w = state.weapon,
    spec = stats[w];
  if (!state.ammo[w]) {
    reload();
    held = false;
    return;
  }
  interruptAction();
  started = true;
  if (aiming) aimAtPointer();
  state.ammo[w]--;
  fireCD = spec.delay;
  const p = player.root.position;
  const muzzle = (w ? player.pistol : player.gun).localToWorld(
    new T.Vector3(0, 0.05, w ? 0.32 : 0.76),
  );
  // If the barrel protrudes through nearby cover, resolve from the player's center.
  const offset = muzzle.clone().sub(p),
    reach = Math.hypot(offset.x, offset.z);
  const origin = firstPerson ? camera.position.clone() : muzzle.clone();
  if (
    !firstPerson &&
    reach > 0 &&
    wallRange(p.x, p.z, offset.x / reach, offset.z / reach, reach) < reach
  ) {
    origin.x = p.x;
    origin.z = p.z;
    muzzle.copy(origin);
  }
  if (firstPerson) {
    camera.getWorldDirection(lookDirection);
    muzzle.copy(equipment.muzzle(w, camera));
  }
  const sight = firstPerson
    ? Math.atan2(lookDirection.x, lookDirection.z)
    : aiming
      ? Math.atan2(aim.x - origin.x, aim.z - origin.z)
      : player.root.rotation.y;
  const drift = driftFor(w);
  const a = sight + drift;
  const dx = Math.sin(a),
    dz = Math.cos(a);
  shotDrift[w] = Math.min(spec.maxDrift, drift + spec.driftStep);
  shotTime[w] = elapsed;
  recoil = w ? 0.18 : 0.112;
  const contact = { kind: null };
  const assisted =
    touchFiring && touchTarget?.hp > 0 ? touchTarget.actor.root.position : null;
  const slope = firstPerson
    ? lookDirection.y /
      Math.max(0.001, Math.hypot(lookDirection.x, lookDirection.z))
    : assisted
      ? (assisted.y + 1.08 - origin.y) /
        Math.max(0.2, Math.hypot(assisted.x - origin.x, assisted.z - origin.z))
      : aiming
        ? (aim.y - origin.y) /
          Math.max(0.2, Math.hypot(aim.x - origin.x, aim.z - origin.z))
        : 0;
  const { range, hit } = traceShot(origin, dx, dz, slope, 28, contact);
  const tip = origin
    .clone()
    .add(new T.Vector3(dx * range, slope * range, dz * range));
  mixer.play(w ? "pistol" : "rifle", { gain: w ? 0.8 : 0.91 });
  if (hit) {
    hit.hp = Math.max(0, hit.hp - (w ? 2 : 1));
    hit.flinch = 1;
    hit.alert = 4;
    hit.engaged = true;
    hit.notice = 1;
    hit.lastSeen.copy(p);
    hit.path = [];
    hit.destination = "";
    hit.knockX = dx * (w ? 2.6 : 1.9);
    hit.knockZ = dz * (w ? 2.6 : 1.9);
    guardParticles(scene, effects, tip, dx, dz);
    for (const m of hit.materials) m.emissiveIntensity = 0.72;
    hit.cd = Math.max(hit.cd, 0.47);
    const rel = a - hit.actor.root.rotation.y;
    hit.back = Math.cos(rel);
    hit.side = Math.sin(rel);
    if (!hit.hp) {
      state.kills++;
      hit.fall = 0.001;
      hit.knockDirX = dx;
      hit.knockDirZ = dz;
      toast("守卫已击退");
    }
    const cross = $("crosshair");
    cross.classList.remove("hit", "down");
    void cross.offsetWidth;
    cross.classList.add(hit.hp ? "hit" : "down");
    impact(tip, "armor", dx, dz);
  } else if (contact.kind) impact(tip, contact.kind, dx, dz);
  investigateNoise(p, w ? 12 : 17);
  shotEffects(muzzle, a, firstPerson ? w : null);
  tracer(muzzle, tip);
  updateHud();
}
function hurt(attacker) {
  if (attacker) markThreat(attacker);
  interruptAction();
  state.hp = Math.max(0, state.hp - 8);
  $("hurt").style.opacity = ".8";
  window.setTimeout(() => ($("hurt").style.opacity = "0"), 140);
  updateHud();
  if (!state.hp) end("failed");
}
function turnGuard(e, heading, dt, speed) {
  const rot = e.actor.root.rotation;
  const delta = Math.atan2(
    Math.sin(heading - rot.y),
    Math.cos(heading - rot.y),
  );
  rot.y += T.MathUtils.clamp(delta, -speed * dt, speed * dt);
}
function walkPath(e, dt, x, z, destination, speed) {
  const ep = e.actor.root.position;
  if (e.destination !== destination) {
    e.path = findPath(ep, x, z);
    e.destination = destination;
  }
  const next = e.path[0];
  if (!next) return true;
  const dx = next.x - ep.x,
    dz = next.z - ep.z,
    d = Math.hypot(dx, dz);
  if (d < 0.09) {
    e.path.shift();
    return !e.path.length;
  }
  const step = Math.min(speed * dt, d) / d;
  move(ep, dx * step, dz * step);
  turnGuard(e, Math.atan2(dx, dz), dt, 5);
  return false;
}
function guardShot(e, d) {
  const muzzle = e.actor.gun.localToWorld(new T.Vector3(0, 0.045, 0.76));
  const p = player.root.position,
    ep = e.actor.root.position;
  const reach = Math.hypot(muzzle.x - ep.x, muzzle.z - ep.z);
  if (
    reach &&
    wallRange(
      ep.x,
      ep.z,
      (muzzle.x - ep.x) / reach,
      (muzzle.z - ep.z) / reach,
      reach,
    ) < reach
  )
    return;
  const spread = 0.054 + playerMotion * 0.036 + 0.011 * Math.min(d, 12);
  const angle =
    Math.atan2(p.x - muzzle.x, p.z - muzzle.z) +
    (random() + random() - 1) * spread;
  const dx = Math.sin(angle),
    dz = Math.cos(angle),
    vx = p.x - muzzle.x,
    vz = p.z - muzzle.z;
  const along = vx * dx + vz * dz,
    side = vx * dz - vz * dx,
    slope = (p.y + 1.1 - muzzle.y) / Math.max(0.25, Math.hypot(vx, vz)),
    range = groundRange(
      muzzle.x,
      muzzle.y,
      muzzle.z,
      dx,
      slope,
      dz,
      wallRange(muzzle.x, muzzle.z, dx, dz, 19, null, muzzle.y, slope),
    );
  const contact = Math.max(
    0,
    along - Math.sqrt(Math.max(0, 0.42 ** 2 - side ** 2)),
  );
  const hit = along > 0 && Math.abs(side) < 0.42 && contact < range;
  const tip = muzzle
    .clone()
    .add(new T.Vector3(dx, slope, dz).multiplyScalar(hit ? contact : range));
  tracer(muzzle, tip, true);
  shotEffects(muzzle, angle);
  spatialSound("rifle", ep, 0.86);
  e.kick = 0.16;
  if (hit) hurt(e);
}
function investigateNoise(point, radius) {
  for (const e of enemies) {
    if (!e.hp || e.engaged || dist(e.actor.root.position, point.x, point.z) > radius) continue;
    if (e.alert <= 0 || e.lastSeen.distanceToSquared(point) > 1) e.destination = "";
    e.lastSeen.copy(point);
    e.alert = 5;
  }
}
function fight(e, dt, p, dx, dz, d) {
  const ep = e.actor.root.position,
    heading = Math.atan2(dx, dz);
  e.alert = 4;
  e.lastSeen.copy(p);
  e.destination = "";
  e.strafeTime -= dt;
  if (e.strafeTime <= 0) {
    e.strafe *= -1;
    e.strafeTime = 1.1 + random() * 1.0;
  }
  turnGuard(e, heading, dt, 7.5);
  const forward = d > 7.4 ? 2.55 : d < 3.1 ? -1.35 : 0.2;
  const lateral = e.strafe * (d > 8 ? 0.75 : 1.75);
  let vx = (dx * forward + dz * lateral) / Math.max(0.01, d),
    vz = (dz * forward - dx * lateral) / Math.max(0.01, d);
  if (blocked(ep.x + vx * 0.32, ep.z + vz * 0.32, 0.44)) {
    e.strafe *= -1;
    e.strafeTime = 1.2;
    vx = (dx / d) * Math.max(0, forward);
    vz = (dz / d) * Math.max(0, forward);
  }
  move(ep, vx * dt, vz * dt);
  if (e.cd <= 0 && Math.cos(heading - e.actor.root.rotation.y) > 0.93) {
    if (!e.burst) e.burst = 2;
    guardShot(e, d);
    e.burst--;
    e.cd = e.burst ? 0.21 : 1.45 + random() * 0.62;
  }
}
function animateDefeat(e, dt) {
  const a = e.actor;
  if (!a.root.visible) return;
  e.deadTime += dt;
  const previous = e.fall;
  e.fall = Math.min(1, e.deadTime / 0.47);
  const k = e.fall * e.fall * (3 - 2 * e.fall),
    bounce = Math.sin(k * Math.PI);
  a.root.rotation.x = e.back * k * 1.53;
  a.root.rotation.z = -e.side * k * 1.53;
  a.root.position.y =
    heightAt(a.root.position.x, a.root.position.z) + 0.32 * k + 0.18 * bounce;
  a.body.rotation.set(0, 0, 0);
  a.head.rotation.x = 0.18 * k;
  a.legs.forEach((leg, i) => (leg.rotation.x = (i ? -0.8 : 0.55) * bounce));
  a.wings.forEach((wing, i) => (wing.rotation.z = (i ? 0.6 : -0.6) * bounce));
  for (const m of e.materials) {
    m.emissiveIntensity = Math.max(0, 0.46 - e.deadTime * 3);
    m.opacity = T.MathUtils.clamp((5.5 - e.deadTime) / 1.25, 0, 1);
  }
  if (previous < 1 && e.fall === 1) {
    const land = new T.Vector3(e.knockDirX * 0.8, 0.15, e.knockDirZ * 0.8);
    land.x += a.root.position.x;
    land.z += a.root.position.z;
    land.y += heightAt(land.x, land.z);
    guardParticles(scene, effects, land, 0, 0, true);
    spatialSound("wood", land, 0.72);
  }
  if (e.deadTime >= 5.5) a.root.visible = false;
}
function reinforce(dt) {
  if (enemies.every((e) => e.hp > 0)) {
    reinforcementTime = reinforcementInterval;
    return;
  }
  reinforcementTime -= dt;
  if (reinforcementTime > 0) return;
  const guard = enemies.find((e) => !e.hp && !e.actor.root.visible);
  if (!guard) return;
  const p = player.root.position;
  const candidates = arrivals.filter(
    ([x, z]) =>
      !blocked(x, z) &&
      dist(p, x, z) > 14 &&
      enemies.every((e) => !e.hp || dist(e.actor.root.position, x, z) > 2),
  );
  candidates.sort((a, b) => dist(p, ...b) - dist(p, ...a));
  if (!candidates.length) return;
  deployGuard(guard, candidates[0]);
  reinforcementTime = reinforcementInterval;
  toast("无线电：货场边缘发现一名增援守卫");
}
function tickEnemies(dt) {
  const p = player.root.position;
  for (const e of enemies) {
    const ep = e.actor.root.position,
      prevX = ep.x,
      prevZ = ep.z;
    if (!e.hp) {
      animateDefeat(e, dt);
      continue;
    }
    move(ep, e.knockX * dt, e.knockZ * dt);
    e.knockX *= Math.exp(-dt * 10);
    e.knockZ *= Math.exp(-dt * 10);
    e.flinch = Math.max(0, e.flinch - dt * 4.5);
    e.kick = Math.max(0, e.kick - dt);
    e.cd -= dt;
    for (const m of e.materials)
      m.emissiveIntensity = Math.max(0, e.flinch - 0.47) * 1.4;
    const dx = p.x - ep.x,
      dz = p.z - ep.z,
      d = Math.hypot(dx, dz);
    const facing = (dx * Math.sin(e.actor.root.rotation.y) + dz * Math.cos(e.actor.root.rotation.y)) / Math.max(d, 0.001);
    const visible =
      (e.engaged || d < 2.2 || facing > 0.42) &&
      d < 15.5 &&
      d > 0.001 &&
      wallRange(ep.x, ep.z, dx / d, dz / d, d) >= d - 0.015 &&
      groundRange(
        ep.x,
        ep.y + 1.2,
        ep.z,
        dx / d,
        (p.y - ep.y) / d,
        dz / d,
        d,
      ) >=
        d - 0.015;
    e.notice = T.MathUtils.clamp(e.notice + dt * (visible ? 1.4 + playerMotion * 0.54 - d * 0.04 : -0.95), 0, 1);
    if (e.notice >= 1) e.engaged = true;
    if (e.flinch < 0.3) {
      if (visible && e.engaged) fight(e, dt, p, dx, dz, d);
      else if (visible) {
        turnGuard(e, Math.atan2(dx, dz), dt, 2.2);
        e.cd = Math.max(e.cd, 0.36);
      }
      else if (e.alert > 0) {
        e.alert = Math.max(0, e.alert - dt);
        if (!e.alert) e.engaged = false;
        e.burst = 0;
        e.cd = Math.max(e.cd, 0.42);
        const arrived = walkPath(
          e,
          dt,
          e.lastSeen.x,
          e.lastSeen.z,
          "search",
          2.55,
        );
        if (arrived)
          e.actor.root.rotation.y += Math.sin(elapsed * 3 + e.phase) * dt;
      } else {
        e.cd = Math.max(e.cd, 0.55);
        e.burst = 0;
        if (e.scanTime > 0) {
          e.scanTime -= dt;
          e.actor.root.rotation.y += dt * 0.55;
        } else if (
          walkPath(e, dt, ...e.route[e.waypoint], "patrol" + e.waypoint, 1.48)
        ) {
          e.waypoint = (e.waypoint + 1) % e.route.length;
          e.scanTime = 0.45;
        }
      }
    }
    if (state.result) return;
    poseDuck(
      e.actor,
      dt,
      elapsed + e.phase,
      (ep.x - prevX) / dt,
      (ep.z - prevZ) / dt,
      e,
    );
    e.actor.gun.position.z = 0.58 - e.kick * 0.65;
    e.actor.gun.rotation.x = 0.045 - e.kick * 0.9;
  }
  reinforce(dt);
}
const impactOrigin = new T.Vector3();
const rubbleSounds = [[0.69, -4.9, 0.76], [0.82, 5.3, 0.9], [0.98, -5.6, 0.69],
  [1.16, 5.8, 0.5], [1.37, -4.8, 0.32], [1.59, 5.2, 0.19]];
function detonate() {
  state.phase = "open";
  state.blastAge = 0;
  world.updateBreach(state.phase, 0);
  world.invalidateReflection();
  investigateNoise(blastCenter, 26);
  muzzleLight.position.copy(blastCenter);
  muzzleLight.intensity = reduceMotion.matches ? 32 : 95;
  spatialSound("blast", blastCenter, 1.36);
  toast("路障已炸开 · 穿过缺口，走上海岸公路");
}
function beginDeparture() {
  screen = "departing";
  held = false;
  resetTouches();
  keys.clear();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  $("iris").hidden = false;
  $("iris").style.setProperty("--opening", "100%");
  state.fadeTime = 0;
}
function end(result) {
  clearAction();
  state.result = result;
  openModal(result);
}
function captureMouse() {
  if (firstPerson && !screen && matchMedia("(any-pointer: fine)").matches &&
      document.pointerLockElement !== canvas) {
    try {
      canvas.requestPointerLock?.()?.catch?.(() => {});
    } catch {
      // Embedded browsers can deny capture. Canvas mouse movement still turns the view.
    }
  }
}
function closeModal() {
  if (screen === "departing") return;
  screen = "";
  captureMouse();
  $("overlay").hidden = true;
  $("liveText").textContent = "行动中";
  $("pause").setAttribute("aria-pressed", "false");
  held = false;
}
function openModal(which) {
  if (screen === "departing") return;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  resetTouches();
  if (state.result) which = state.result;
  screen = which;
  held = false;
  keys.clear();
  joystickX = joystickY = 0;
  $("overlay").hidden = false;
  $("liveText").textContent = state.result ? "已结束" : "已暂停";
  $("pause").setAttribute("aria-pressed", "true");
  const names = {
    pause: ["PAUSE", "行动暂停"],
    settings: ["SYSTEM", "行动设置"],
    map: ["TACTICAL MAP", "灰港战术地图"],
    bag: ["INVENTORY", "行动背包"],
    success: ["EXTRACTED", "成功撤离"],
    failed: ["OPERATION FAILED", "行动失败"],
  };
  const [eng, title] = names[which];
  let content = "";
  if (which === "pause")
    content =
      '<button class="action primary" data-cmd="resume">继续行动</button><button class="action" data-cmd="settings">行动设置</button><button class="action" data-cmd="restart">重新部署</button>';
  if (which === "settings")
    content =
      '<div class="row"><span>画质</span><select id="quality"><option value="auto">极致 · 自适应</option><option value="4k">电影 · 4K UHD</option><option value="balanced">流畅</option></select></div><div class="row"><span>行动音效</span><button data-cmd="audio">' +
      (sound ? "开启" : "关闭") +
      '</button></div><label class="row"><span>音效音量</span><input type="range" id="volume" min="0" max="100"></label><p class="desktop-guide">C 切换人称。第一人称下移动鼠标环顾，左键射击，Esc 暂停并释放鼠标。第三人称下双指环绕、捏合缩放。鼠标右键拖动也可环绕。键盘 Z / X 转向，I / K 调俯仰，− / = 缩放，V 恢复默认视角。</p><p class="touch-guide">点击右上角 3P / 1P 切换人称。左摇杆移动，推过外环疾跑。右半屏滑动转视角，原地按住约 0.3 秒开火，继续拖动可边打边瞄，松手停火。步枪可连发，手枪用开火键点射。第三人称可双指捏合缩放。点击小地图查看整个港区。</p><button class="action primary" data-cmd="resume">返回行动</button>';
  if (which === "bag")
    content =
      '<div class="row"><span>爆破包</span><b>' +
      ({supply: "未取得", carry: "携带中", armed: "已放置", open: "已使用"}[state.phase]) +
      '</b></div><div class="row"><span>步枪备用弹药</span><b>' +
      state.reserve[0] +
      '</b></div><div class="row"><span>手枪备用弹药</span><b>' +
      state.reserve[1] +
      '</b></div><div class="row"><span>医疗包 × ' +
      state.meds +
      '</span><button data-cmd="heal">使用</button></div><button class="action primary" data-cmd="resume">返回行动</button>';
  if (which === "map")
    content =
      '<canvas class="map-large" id="bigmap" width="600" height="600"></canvas><div class="map-key"><b>▲ 侦察鸭</b><span>◇ 爆破包</span><span>✛ 南侧出口</span></div><button class="action primary" data-cmd="resume">返回行动</button>';
  if (state.result)
    content =
      "<p>" +
      (which === "success"
        ? "你穿过碎石缺口，沿海岸公路离开了灰港。"
        : state.time <= 0
          ? "行动时间结束。"
          : "侦察鸭失去行动能力。") +
      '</p><div class="row"><span>爆破包</span><b>' +
      ({supply: "未取得", carry: "携带中", armed: "已放置", open: "已使用"}[state.phase]) +
      '</b></div><div class="row"><span>击退守卫</span><b>' +
      state.kills +
      '</b></div><button class="action primary" data-cmd="restart">重新部署</button>';
  $("modal").innerHTML =
    '<div class="modal-top"><div class="eyebrow amber">' +
    eng +
    "</div>" +
    (!state.result
      ? '<button data-cmd="resume" aria-label="关闭">' +
        icon("close") +
        "</button>"
      : "") +
    "</div><h2>" +
    title +
    "</h2>" +
    content;
  if (which === "settings") {
    $("volume").value = Math.round(volume * 100);
    $("volume").oninput = (e) => {
      volume = Number(e.target.value) / 100;
      saveSettings();
    };
    $("volume").onchange = () => {
      mixer.unlock();
      mixer.play("latch", { gain: 0.55 });
    };
    $("quality").value = quality;
    $("quality").onchange = (e) => {
      quality = e.target.value;
      renderScale = 1;
      saveSettings();
      resize();
    };
  }
  if (which === "map") drawMap($("bigmap"), true);
  $("modal").querySelector("button,select")?.focus();
}
$("modal").onclick = (e) => {
  const cmd = e.target.closest("[data-cmd]")?.dataset.cmd;
  if (cmd === "resume") closeModal();
  if (cmd === "settings") openModal("settings");
  if (cmd === "restart") reset();
  if (cmd === "audio") {
    sound = !sound;
    saveSettings();
    mixer.unlock();
    openModal("settings");
  }
  if (cmd === "heal") {
    closeModal();
    heal();
  }
};
$("overlay").onclick = (e) => {
  if (e.target === $("overlay") && !state.result) closeModal();
};
$("sound").onclick = () => {
  sound = !sound;
  saveSettings();
  if (sound) {
    mixer.unlock();
    tone(500, 0.13);
  }
};
$("settings").onclick = () =>
  screen === "settings" ? closeModal() : openModal("settings");
$("pause").onclick = () =>
  screen && !state.result ? closeModal() : openModal("pause");
$("mapButton").onclick = () => openModal("map");
$("hotbar").onclick = (e) => {
  let slot = e.target.closest("[data-slot]");
  if (slot) equip(Number(slot.dataset.slot));
};
window.addEventListener("keydown", (e) => {
  const c = e.code;
  if (
    !screen &&
    [
      "Tab",
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(c)
  )
    e.preventDefault();
  if (e.repeat) {
    return;
  }
  if (state.result) return;
  if (c === "Escape") {
    screen ? closeModal() : openModal("pause");
    return;
  }
  if (c === "Tab" || c === "KeyM") {
    if (screen && screen !== "bag" && screen !== "map") return;
    e.preventDefault();
    let dest = c === "Tab" ? "bag" : "map";
    screen === dest ? closeModal() : openModal(dest);
    return;
  }
  if (screen) return;
  keys.add(c);
  if (c === "KeyC") {
    setPerspective(!firstPerson);
    return;
  }
  if (c === "KeyV") {
    targetLookPitch = 0;
    targetYaw = defaultYaw;
    targetPitch = defaultPitch;
    targetRadius = defaultRadius;
  }
  if (c === "Space") {
    if (aiming) aimAtPointer();
    shoot();
  }
  if (
    [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(c)
  )
    started = true;
  if (c === "KeyR") reload();
  if (c === "KeyF" || c === "KeyE") interact();
  if (["Digit1", "Digit2", "Digit3"].includes(c))
    equip(Number(c.slice(-1)) - 1);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
function setPerspective(on) {
  firstPerson = on;
  held = false;
  resetTouches();
  aiming = false;
  if (on) {
    targetLookPitch = lookPitch = 0;
  } else if (document.pointerLockElement === canvas) document.exitPointerLock();
  equipment.clearFlash();
  equipment.pass.enabled = on;
  player.root.visible = !on;
  viewport.classList.toggle("first-person", on);
  chevron.hidden = on;
  const button = $("perspective");
  button.textContent = on ? "1P" : "3P";
  button.setAttribute("aria-pressed", String(on));
  button.title = on ? "切换到第三人称 (C)" : "切换到第一人称 (C)";
  button.setAttribute("aria-label", button.title);
  $("crosshair").style.left = on ? "50%" : "";
  $("crosshair").style.top = on ? "50%" : "";
  camera.fov = on ? 67 : camera.aspect < 1 ? 47 : 36;
  camera.updateProjectionMatrix();
  $("lookBinding").textContent = on ? "移动鼠标" : "双指滑动 / 捏合";
  if (on) {
    occlusion.depth.value = -1;
    placeEye();
    equipment.update(0, centerAimDepth());
    captureMouse();
  }
  else {
    focus.copy(player.root.position);
    focus.y += 1.35;
    camera.position.copy(focus).add(camOffset);
    camera.lookAt(focus);
    camera.updateMatrixWorld();
  }
}
function placeEye() {
  const p = player.root.position;
  camera.position.set(p.x, p.y + 1.65, p.z);
  camera.rotation.set(lookPitch, yaw, 0, "YXZ");
  camera.updateMatrixWorld();
  player.root.rotation.y = yaw + Math.PI;
}
function turnEye(dx, dy) {
  targetYaw -= dx * 0.0034;
  targetLookPitch = T.MathUtils.clamp(
    targetLookPitch - dy * 0.0034,
    -1.36,
    1.36,
  );
}
$("perspective").onclick = () => {
  if (!screen) setPerspective(!firstPerson);
};
let mouseCaptured = false;
document.addEventListener("pointerlockchange", () => {
  const captured = document.pointerLockElement === canvas;
  if (captured && (!firstPerson || screen)) document.exitPointerLock();
  if (!captured && mouseCaptured && firstPerson && !screen) openModal("pause");
  mouseCaptured = captured;
});
document.addEventListener("mousemove", (e) => {
  if (firstPerson && !screen && document.pointerLockElement === canvas)
    turnEye(e.movementX, e.movementY);
});
function pointerAim(e) {
  if (firstPerson) return;
  const r = canvas.getBoundingClientRect();
  pointer.set(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    1 - ((e.clientY - r.top) / r.height) * 2,
  );
  aiming = true;
  $("crosshair").style.left = e.clientX - r.left + "px";
  $("crosshair").style.top = e.clientY - r.top + "px";
}
canvas.addEventListener("pointermove", (e) => {
  if (screen || e.pointerType === "touch") return;
  if (firstPerson && document.pointerLockElement !== canvas) {
    turnEye(e.movementX, e.movementY);
  } else if (!(e.buttons & 2)) pointerAim(e);
});
function aimAtPointer() {
  if (firstPerson) return;
  ray.setFromCamera(pointer, camera);
  const o = ray.ray.origin,
    dir = ray.ray.direction;
  ray.ray.at(groundRange(o.x, o.y, o.z, dir.x, dir.y, dir.z, 150, 1.08), aim);
  player.root.rotation.y = Math.atan2(
    aim.x - player.root.position.x,
    aim.z - player.root.position.z,
  );
}
canvas.addEventListener("pointerdown", (e) => {
  if (e.button || screen || e.pointerType === "touch") return;
  captureMouse();
  pointerAim(e);
  aimAtPointer();
  held = true;
  shoot();
});
window.addEventListener("pointerup", (e) => {
  if (e.pointerType !== "touch") held = false;
});
window.addEventListener("pointercancel", (e) => {
  if (e.pointerType !== "touch") held = false;
});
canvas.oncontextmenu = (e) => e.preventDefault();
function suspend() {
  resetTouches();
  held = false;
  keys.clear();
  joystickX = joystickY = 0;
  if ((started || firstPerson) && !screen && !state.result) openModal("pause");
}
window.addEventListener("blur", suspend);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspend();
});
const stick = $("stick"),
  fireButton = $("touchFire");
let touchSprint = false,
  touchFiring = false,
  sceneFiring = false,
  touchTarget = null,
  fireX = 0,
  fireY = 0,
  aimStickX = 0,
  aimStickY = 0;
function steer(e) {
  const r = stick.getBoundingClientRect(),
    x = (e.clientX - r.left - r.width / 2) / (r.width * 0.4),
    y = (e.clientY - r.top - r.height / 2) / (r.height * 0.4);
  const length = Math.hypot(x, y);
  joystickX = x / Math.max(1, length);
  joystickY = y / Math.max(1, length);
  touchSprint = length > 1.13;
  stick.classList.toggle("sprinting", touchSprint);
  stick.firstElementChild.style.transform =
    "translate(" + joystickX * 22 + "px," + joystickY * 22 + "px)";
  started = true;
  aiming = false;
}
const stopStick = bindDrag(stick, {
  start(e) {
    if (screen) return false;
    steer(e);
  },
  move: steer,
  end() {
    joystickX = joystickY = 0;
    touchSprint = false;
    stick.classList.remove("sprinting");
    stick.firstElementChild.style.transform = "none";
  },
});
function adjustPitch(delta) {
  if (firstPerson) {
    targetLookPitch = T.MathUtils.clamp(targetLookPitch + delta, -1.36, 1.36);
    return;
  }
  targetPitch = T.MathUtils.clamp(
    targetPitch + delta,
    Math.PI / 90,
    (Math.PI * 4) / 9,
  );
}
function adjustZoom(factor) {
  if (firstPerson) return;
  targetRadius = T.MathUtils.clamp(targetRadius * factor, 14.5, 36);
}
const stopLook = bindCameraInput(canvas, {
  enabled: () => !screen,
  mouseDrag: () => !firstPerson,
  beginFire() {
    if (touchFiring) return;
    sceneFiring = true;
    aiming = false;
    if (!firstPerson) player.root.rotation.y = yaw + Math.PI;
    fireButton.classList.add("pressed");
    shoot();
  },
  endFire() {
    sceneFiring = false;
    fireButton.classList.toggle("pressed", touchFiring);
  },
  start: () => {
    aiming = false;
  },
  rotate(dx, dy) {
    if (firstPerson) {
      turnEye(dx, dy);
      return;
    }
    targetYaw -= dx * 0.006;
    adjustPitch(dy * 0.0045);
  },
  zoom: adjustZoom,
});
function aimTouch() {
  if (firstPerson) return;
  if (Math.hypot(aimStickX, aimStickY) > 7) {
    player.root.rotation.y = Math.atan2(
      right.x * aimStickX - forward.x * aimStickY,
      right.z * aimStickX - forward.z * aimStickY,
    );
  }
}
const stopFire = bindDrag(fireButton, {
  start(e) {
    if (screen) return false;
    stopLook();
    fireX = e.clientX;
    fireY = e.clientY;
    aiming = false;
    aimStickX = aimStickY = 0;
    // A tap assists only against nearby guards with a clear line of sight.
    let best = firstPerson ? 0 : 13;
    touchTarget = null;
    for (const enemy of enemies) {
      if (!enemy.hp) continue;
      const ep = enemy.actor.root.position,
        p = player.root.position,
        dx = ep.x - p.x,
        dz = ep.z - p.z,
        d = Math.hypot(dx, dz);
      if (
        d > 0.01 &&
        d < best &&
        wallRange(p.x, p.z, dx / d, dz / d, d) >= d - 0.02
      ) {
        best = d;
        touchTarget = enemy;
        player.root.rotation.y = Math.atan2(dx, dz);
      }
    }
    touchFiring = true;
    fireButton.classList.add("pressed");
    shoot();
  },
  move(e) {
    if (firstPerson) {
      turnEye(e.clientX - fireX, e.clientY - fireY);
      fireX = e.clientX;
      fireY = e.clientY;
      return;
    }
    aimStickX = e.clientX - fireX;
    aimStickY = e.clientY - fireY;
    if (Math.hypot(aimStickX, aimStickY) > 7) touchTarget = null;
    aimTouch();
  },
  end() {
    touchFiring = false;
    aimStickX = aimStickY = 0;
    fireButton.classList.remove("pressed");
  },
});
function resetTouches() {
  stopStick();
  stopLook();
  stopFire();
}
$("touchAct").onclick = interact;
$("touchReload").onclick = reload;
// Stop at a walkable point in the interaction circle: the cases themselves are solid.
const routeGuide = { goal: null, x: 0, z: 0, points: [] };
function guidedPath(p, goal, radius) {
  if (goal === routeGuide.goal && dist(p, routeGuide.x, routeGuide.z) < 0.85) {
    while (routeGuide.points.length > 1 && dist(p, routeGuide.points[0].x, routeGuide.points[0].z) < 0.35)
      routeGuide.points.shift();
    return routeGuide.points;
  }
  let points = [];
  const approach = Math.atan2(p.z - goal[1], p.x - goal[0]);
  for (const offset of [0, 1, -1, 2, -2, 3, -3, 4]) {
    const angle = approach + offset * Math.PI / 4;
    const x = goal[0] + Math.cos(angle) * (radius - 0.7);
    const z = goal[1] + Math.sin(angle) * (radius - 0.7);
    if (blocked(x, z, 0.5)) continue;
    points = findPath(p, x, z);
    if (points.length) break;
  }
  Object.assign(routeGuide, { goal, x: p.x, z: p.z, points });
  return points;
}
function drawObjectiveGuide(c, X, Y, scale, full) {
  const p = player.root.position;
  const goal = currentGoal();
  const leaving = goal === roadExit;
  const radius = goal === supply ? pickupRange : leaving ? 0.8 : extractionRange;
  const color = leaving ? "#a6e3b6" : "#ffbf65";
  const [x, z] = goal;
  const distance = dist(p, x, z);
  const inRange = distance < radius;
  const path = inRange ? [] : leaving && p.z < breach[1] - 1 ?
    [...guidedPath(p, breach, extractionRange), {x: breach[0], z: breach[1]}] :
    leaving ? [] : guidedPath(p, goal, radius);
  const next = path[0] || {x, z};
  const dx = next.x - p.x, dy = next.z - p.z;
  c.save();
  c.fillStyle = color + (inRange ? "50" : "2c");
  c.strokeStyle = color;
  c.lineWidth = full ? 1.5 : 3;
  c.beginPath();
  c.arc(X(x), Y(z), radius * scale, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  if (!inRange) {
    // Clip the route at its first crossing so the arrow shows the next turn.
    let ax = X(p.x), ay = Y(p.z), edgeAngle = null;
    c.setLineDash([6, 5]);
    c.beginPath();
    c.moveTo(ax, ay);
    for (const point of [...path, { x, z }]) {
      const vx = X(point.x) - ax, vy = Y(point.z) - ay;
      const k = full ? 1 : Math.min(1,
        vx > 0 ? (c.canvas.width - 14 - ax) / vx : vx < 0 ? (14 - ax) / vx : 1,
        vy > 0 ? (c.canvas.height - 14 - ay) / vy : vy < 0 ? (14 - ay) / vy : 1);
      ax += k * vx;
      ay += k * vy;
      c.lineTo(ax, ay);
      if (k < 1) {
        edgeAngle = Math.atan2(vy, vx);
        break;
      }
    }
    c.stroke();
    if (edgeAngle !== null) {
      c.translate(ax, ay);
      c.rotate(edgeAngle);
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(10, 0);
      c.lineTo(-9, -8);
      c.lineTo(-5, 0);
      c.lineTo(-9, 8);
      c.closePath();
      c.fill();
    }
  }
  c.restore();
  if (!full) {
    const headings = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    const heading = headings[(Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) + 8) % 8];
    $("mapGoal").textContent = leaving ? "海岸公路" : goal === supply ? "爆破包" : "南侧路障";
    let routeDistance = 0, previous = p;
    for (const point of path) {
      routeDistance += dist(previous, point.x, point.z);
      previous = point;
    }
    routeDistance += dist(previous, x, z);
    $("mapBearing").textContent = inRange ? (state.phase === "armed" ? "倒计时" : leaving ? "向前走" : "可交互") : heading + " " + Math.round(routeDistance) + " m";
    $("mapGuide").style.color = color;
  }
}
function drawMap(el, full = false) {
  const c = el.getContext("2d"),
    w = el.width,
    h = el.height,
    p = player.root.position;
  const span = full
      ? Math.max(yard.east - yard.west, yard.south - yard.north) + 24
      : 31,
    s = w / span,
    cx = full ? 0 : p.x,
    cz = full ? 0 : p.z;
  const X = (x) => w / 2 + (x - cx) * s,
    Y = (z) => h / 2 + (z - cz) * s;
  c.fillStyle = "#27332e";
  c.fillRect(0, 0, w, h);
  c.lineWidth = 1;
  c.strokeStyle = "#67756947";
  c.beginPath();
  for (let k = -76; k <= 76; k += full ? 6 : 2) {
    c.moveTo(X(k), 0);
    c.lineTo(X(k), h);
    c.moveTo(0, Y(k));
    c.lineTo(w, Y(k));
  }
  c.stroke();
  c.strokeStyle = "#768071";
  c.beginPath();
  c.moveTo(X(breach[0] - gapHalf), Y(yard.south));
  c.lineTo(X(yard.west), Y(yard.south));
  c.lineTo(X(yard.west), Y(yard.north));
  c.lineTo(X(yard.east), Y(yard.north));
  c.lineTo(X(yard.east), Y(yard.south));
  c.lineTo(X(breach[0] + gapHalf), Y(yard.south));
  c.stroke();
  c.fillStyle = "#4a514b";
  c.fillRect(0, Y(roadExit[1] - 1.75), w, 7.5 * s);
  c.fillRect(X(breach[0] - gapHalf), Y(yard.south - 1), gapHalf * 2 * s, 8 * s);
  c.fillStyle = "#b2a27f";
  for (let x = -87; x < 88; x += 5)
    c.fillRect(X(x), Y(roadExit[1] + 2), 2.8 * s, Math.max(1, 0.14 * s));
  for (const o of obstacles) {
    if (o.disabled) continue;
    c.fillStyle = "#677166";
    c.fillRect(X(o.x - o.w / 2), Y(o.z - o.d / 2), o.w * s, o.d * s);
  }
  for (const o of lots) {
    c.fillStyle = ["#62706c", "#7c7361", "#69766a", "#79765f", "#676f69"][
      o.color
    ];
    c.fillRect(X(o.x - o.w / 2), Y(o.z - o.d / 2), o.w * s, o.d * s);
    c.strokeStyle = "#9da48d";
    c.strokeRect(X(o.x - o.w / 2), Y(o.z - o.d / 2), o.w * s, o.d * s);
  }
  if (full) {
    c.font = "bold 14px sans-serif";
    c.textAlign = "center";
    c.lineWidth = 3;
    for (const d of districts) {
      c.strokeStyle = "#1a201c";
      c.strokeText(d.name, X(d.x), Y(d.z + 6));
      c.fillStyle = "#d8d8c5";
      c.fillText(d.name, X(d.x), Y(d.z + 6));
    }
  }
  drawObjectiveGuide(c, X, Y, s, full);
  if (state.phase === "supply") {
    c.save();
    c.translate(X(supply[0]), Y(supply[1]));
    c.rotate(Math.PI / 4);
    c.strokeStyle = "#faca72";
    c.strokeRect(-4, -4, 8, 8);
    c.restore();
  }
  const destination = state.phase === "open" ? roadExit : breach;
  c.fillStyle = state.phase === "open" ? "#a4ccaa" : "#dcab75";
  c.fillRect(X(destination[0]) - 6, Y(destination[1]) - 2, 12, 4);
  c.fillRect(X(destination[0]) - 2, Y(destination[1]) - 6, 4, 12);
  for (const e of enemies) {
    const pos = e.actor.root.position;
    if (e.hp > 0 && dist(p, pos.x, pos.z) < 12) {
      {
        const heading = Math.PI / 2 - e.actor.root.rotation.y;
        c.fillStyle = e.engaged ? "#ef85675c" : "#e2b88355";
        c.beginPath();
        c.moveTo(X(pos.x), Y(pos.z));
        c.arc(X(pos.x), Y(pos.z), 3.4 * s, heading - 1.14, heading + 1.14);
        c.closePath();
        c.fill();
      }
      c.fillStyle = "#d68a73";
      c.beginPath();
      c.arc(X(pos.x), Y(pos.z), 3, 0, 7);
      c.fill();
    }
  }
  c.save();
  c.translate(X(p.x), Y(p.z));
  c.rotate(-player.root.rotation.y + Math.PI);
  c.fillStyle = "#eed3942b";
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, 35, -2.1, -1.05);
  c.closePath();
  c.fill();
  c.fillStyle = "#ffd78a";
  c.strokeStyle = "#282e26";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, -9);
  c.lineTo(6.5, 7);
  c.lineTo(0, 4);
  c.lineTo(-6.5, 7);
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
}
function worldTag(el, x, y, z) {
  v3.set(x, y, z).project(camera);
  el.hidden = Math.abs(v3.x) > 1.03 || Math.abs(v3.y) > 0.96 || v3.z > 1;
  el.style.left = (v3.x * 0.5 + 0.5) * 100 + "%";
  el.style.top = (0.5 - v3.y * 0.5) * 100 + "%";
}
function labels() {
  const p = player.root.position;
  const goal = currentGoal(), distance = dist(p, ...goal);
  worldTag(objectiveMarker, goal[0], heightAt(...goal) + (goal === breach ? 2.6 : 1.3), goal[1]);
  objectiveMarker.hidden ||= distance > 30;
  objectiveMarker.classList.toggle("exit", goal === roadExit);
  objectiveMarker.lastChild.textContent = Math.round(distance) + " m";
  if (firstPerson) chevron.hidden = true;
  else worldTag(chevron, p.x, p.y + 2.63, p.z);
  const danger = enemies.reduce((level, e) => {
    if (!e.hp) return level;
    return Math.max(level, e.engaged && e.alert > 0 ? 1 : e.notice);
  }, 0);
  $("alertBar").hidden = danger < 0.06;
  $("alertBar").classList.toggle("detected", danger >= 1);
  $("alertBar").firstElementChild.textContent = danger >= 1 ? "守卫警戒" : "正在被发现";
  $("alertBar").style.setProperty("--notice", Math.round(danger * 100) + "%");
  const next = nearbyAction();
  const verb = next ? next.point === supply ? "拾取" : "放置" : "交互";
  $("touchAct").textContent = verb;
  const key = matchMedia("(pointer:coarse)").matches ? "点按" + verb + " · " : "[ F ]  ";
  $("hint").textContent = next ? key + next.label :
    state.phase === "armed" ? "后退 · " + Math.ceil(state.fuse) :
    goal === supply && dist(p, ...breach) < extractionRange ? "需要爆破包" : "";
  const deg = ((Math.atan2(forward.x, -forward.z) * 180) / Math.PI + 360) % 360;
  document.querySelector(".bearing").textContent =
    Math.round(deg).toString().padStart(3, "0") + "°";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const center = Math.round(deg / 15) * 15;
  [...document.querySelector(".directions").children].forEach((el, i) => {
    const d = (center + (i - 3) * 15 + 360) % 360;
    el.textContent = d % 45 === 0 ? dirs[d / 45] : d;
  });
}
const right = new T.Vector3(camOffset.z, 0, -camOffset.x).normalize(),
  forward = new T.Vector3(-camOffset.x, 0, -camOffset.z).normalize();
function updateOrbit(dt) {
  targetYaw +=
    ((keys.has("KeyX") ? 1 : 0) - (keys.has("KeyZ") ? 1 : 0)) * dt * 2.15;
  adjustPitch((Number(keys.has("KeyI")) - Number(keys.has("KeyK"))) * dt * 1.5);
  adjustZoom(
    Math.exp(
      (Number(keys.has("Minus")) - Number(keys.has("Equal"))) * dt * 1.3,
    ),
  );
  const blend = 1 - Math.exp(-dt * 16);
  yaw = T.MathUtils.lerp(yaw, targetYaw, blend);
  lookPitch = T.MathUtils.lerp(lookPitch, targetLookPitch, blend);
  pitch = T.MathUtils.lerp(pitch, targetPitch, blend);
  radius = T.MathUtils.lerp(radius, targetRadius, blend);
  const horizontal = radius * Math.cos(pitch);
  camOffset.set(
    horizontal * Math.sin(yaw),
    radius * Math.sin(pitch),
    horizontal * Math.cos(yaw),
  );
  right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
}
let last = 0,
  frames = 0,
  frameTime = 0,
  uiTime = 0,
  slowPeriods = 0;
function loop(ms) {
  requestAnimationFrame(loop);
  if (document.hidden) {
    last = ms;
    return;
  }
  const raw = (ms - last) / 1000 || 0.016,
    dt = Math.min(0.06, Math.max(0.001, raw));
  last = ms;
  if (screen === "departing") {
    state.fadeTime += Math.min(raw, 0.12);
    const t = T.MathUtils.smoothstep(state.fadeTime, 0, 1.25);
    $("iris").style.setProperty("--opening", (100 - 115 * t) + "%");
    if (state.fadeTime >= 1.55) {
      screen = "";
      end("success");
      $("iris").hidden = true;
    }
    return;
  }
  if (!screen) {
    elapsed += dt;
    updateOrbit(dt);
    if (touchFiring) aimTouch();
    const p = player.root.position;
    const ix =
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
        (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) +
        joystickX,
      iy =
        (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
        (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
        joystickY;
    const len = Math.hypot(ix, iy),
      sprint =
        len > 0.1 &&
        (keys.has("ShiftLeft") || keys.has("ShiftRight") || touchSprint) &&
        state.stamina > 2;
    const speed = sprint ? 6.55 : 3.97;
    let mx = (right.x * ix + forward.x * iy) / Math.max(1, len),
      mz = (right.z * ix + forward.z * iy) / Math.max(1, len);
    const prevX = p.x,
      prevZ = p.z;
    move(p, mx * speed * dt, mz * speed * dt);
    state.stamina = T.MathUtils.clamp(
      state.stamina + (sprint ? -18 : 12) * dt,
      0,
      100,
    );
    if (len > 0.08) interruptAction();
    playerMotion = sprint ? 1.9 : Math.min(1, len);
    if (sceneFiring && !firstPerson) player.root.rotation.y = yaw + Math.PI;
    else if (!aiming && !touchFiring && len > 0.08)
      player.root.rotation.y = Math.atan2(mx, mz);
    focus.lerp(v3.set(p.x, p.y + 1.35, p.z), 1 - Math.exp(-dt * 7.5));
    if (firstPerson) {
      placeEye();
    } else {
      camera.position.copy(focus).add(camOffset);
      const requiredLift = cameraLift(camera.position);
      lift = Math.max(
        requiredLift,
        T.MathUtils.lerp(lift, requiredLift, 1 - Math.exp(-dt * 8)),
      );
      camera.position.y += lift;
      camera.lookAt(focus);
      camera.updateMatrixWorld();
      if (action) {
        const [x, z] = action.point,
          angle = Math.atan2(x - p.x, z - p.z) - player.root.rotation.y;
        player.root.rotation.y +=
          Math.atan2(Math.sin(angle), Math.cos(angle)) *
          (1 - Math.exp(-dt * 13));
      } else if (aiming) aimAtPointer();
    }
    poseDuck(player, dt, elapsed, (p.x - prevX) / dt, (p.z - prevZ) / dt, {
      search: Boolean(action),

      kick: recoil,
    });
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 330);
    recoil = Math.max(0, recoil - dt);
    $("crosshair").style.setProperty(
      "--gap",
      Math.min(16, driftFor(state.weapon) * 107) + "px",
    );
    if (fireCD > 0) fireCD -= dt;
    if (reloadTime > 0) {
      const duration = stats[state.weapon].reload;
      const before = 1 - reloadTime / duration;
      reloadTime -= dt;
      const after = 1 - Math.max(0, reloadTime) / duration;
      if (before < magRelease && after >= magRelease)
        mixer.play("latch", { gain: 0.3 });
      if (before < magSeat && after >= magSeat)
        mixer.play("latch", { gain: 0.52 });
      if (reloadTime <= 0) {
        reloadTime = 0;
        const w = state.weapon,
          n = Math.min(stats[w].cap - state.ammo[w], state.reserve[w]);
        state.ammo[w] += n;
        state.reserve[w] -= n;
        updateHud();
      }
    }
    poseLoadout(
      player,
      state.weapon,
      reloadTime > 0 ? 1 - reloadTime / stats[state.weapon].reload : 0,
      recoil,
    );
    if (firstPerson) equipment.update(dt, centerAimDepth());
    if ((held || touchFiring || sceneFiring || keys.has("Space")) && state.weapon === 0)
      shoot();
    if (started) {
      if (state.phase === "armed") {
        const before = Math.ceil(state.fuse);
        state.fuse = Math.max(0, state.fuse - Math.min(raw, 0.5));
        if (!state.fuse) detonate();
        else if (Math.ceil(state.fuse) !== before) tone(800, 0.085);
        if (before !== Math.ceil(state.fuse)) updateHud();
      } else if (state.phase === "open") {
        const before = state.blastAge;
        state.blastAge += Math.min(raw, 0.25);
        for (const [time, offset, gain] of rubbleSounds) {
          if (before < time && state.blastAge >= time) {
            impactOrigin.copy(blastCenter);
            impactOrigin.x += offset;
            spatialSound("rubble", impactOrigin, gain);
          }
        }
        if (p.z >= roadExit[1]) {
          beginDeparture();
          return;
        }
      }
      state.time = Math.max(0, state.time - Math.min(raw, 0.5));
      tickEnemies(dt);
      if (!state.time && !state.result) end("failed");
      if (action && !screen) tickAction(Math.min(raw, 0.25));
    }
    if (firstPerson) {
      occlusion.center.value.set(0.5, 0.5);
      occlusion.depth.value = -1;
    } else {
      v3.copy(p);
      v3.y = p.y + 1.22;
      v3.applyMatrix4(camera.matrixWorldInverse);
      occlusion.depth.value = -v3.z;
      v3.applyMatrix4(camera.projectionMatrix);
      occlusion.center.value.set(v3.x * 0.5 + 0.5, v3.y * 0.5 + 0.5);
      occlusion.aspect.value = camera.aspect;
    }
    updateThreats();
    dust.position.set(
      Math.sin(elapsed * 0.1) * 0.68,
      Math.sin(elapsed * 0.19) * 0.18,
      Math.cos(elapsed * 0.08) * 0.42,
    );
    vapor.update(dt);
    for (let i = effects.length - 1; i >= 0; i--) {
      const f = effects[i];
      if (f.fresh) {
        f.fresh = false;
        continue;
      }
      f.ttl -= dt;
      if (f.tracer) {
        const t = Math.min(1, 1 - f.ttl / 0.076);
        f.object.position.copy(f.from).addScaledVector(f.direction, f.object.scale.y / 2 + t * f.travel);
        f.object.scale.x = f.object.scale.z = 0.016 * (1 - t * 0.8);
      }
      if (f.spin) {
        f.object.rotation.x += dt * 14;
        f.object.rotation.z += dt * 7;
      }
      if (f.particle) tickGuardParticle(f, dt);
      else if (f.vel) {
        f.object.position.addScaledVector(f.vel, dt);
        f.vel.y -= dt * 7;
      }
      if (f.ttl <= 0) {
        fxRemove(f);
        effects.splice(i, 1);
      }
    }
    if (toastTime > 0) {
      toastTime -= dt;
      if (toastTime <= 0) $("toast").textContent = "";
    }
    uiTime += dt;
    if (uiTime > 0.06) {
      uiTime = 0;
      labels();
      drawMap($("mini"));
      $("stbar").style.width = state.stamina + "%";
      let sec = Math.ceil(state.time);
      $("timer").textContent =
        Math.floor(sec / 60)
          .toString()
          .padStart(2, "0") +
        ":" +
        (sec % 60).toString().padStart(2, "0");
    }
    sun.position.set(p.x - 19, 13, p.z - 9);
    sun.target.position.set(p.x, 0, p.z - 1);
    world.sectors.forEach((sector, i) => {
      sector.visible =
        Math.abs(p.x - districts[i].x) < 58 &&
        Math.abs(p.z - districts[i].z) < 59;
    });
    world.updateBreach(state.phase, state.blastAge);
    showBreachEffects(state.phase === "open" ? state.blastAge : -1);
    if (state.phase === "open" && state.blastAge < 0.42 && !reduceMotion.matches) {
      const t = state.blastAge;
      const strength = Math.exp(-9 * t) / (1 + player.root.position.distanceTo(blastCenter) * 0.16);
      camera.rotateX(strength * 0.022 * Math.cos(42 * t));
      camera.rotateZ(strength * 0.012 * Math.sin(61 * t));
      camera.updateMatrixWorld();
    }
    fire(elapsed, renderer.domElement.height);
    composer.render();
  }
  frames++;
  frameTime += Math.min(raw, 1);
  if (frameTime > 1.1) {
    const fps = Math.round(frames / frameTime);
    $("fps").textContent = fps + " FPS";
    if (!screen && quality === "auto") {
      slowPeriods = fps < 39 ? slowPeriods + 1 : 0;
      if (slowPeriods >= 3 && renderScale > 0.7) {
        renderScale = Math.max(0.7, renderScale - 0.1);
        resize();
        slowPeriods = 0;
      }
    }
    frames = 0;
    frameTime = 0;
  }
}
reset();
labels();
drawMap($("mini"));
renderer.compile(scene, camera);
T.DefaultLoadingManager.onLoad = () => {
  $("loading").hidden = true;
};
requestAnimationFrame(loop);
