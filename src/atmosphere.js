import * as T from "three";
import { canvasTex, random } from "./model.js";

// Thin, rising flame tongues share one batch. Each point gets its own drift and lifetime.
export function barrelFire(scene, x, z) {
  const count = 110,
    positions = new Float32Array(count * 3),
    seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i * 3] = random();
    seeds[i * 3 + 1] = random();
    seeds[i * 3 + 2] = random();
  }
  const geom = new T.BufferGeometry();
  geom.setAttribute("position", new T.BufferAttribute(positions, 3));
  geom.setAttribute("aSeed", new T.BufferAttribute(seeds, 3));
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 700 } },
    vertexShader: `attribute vec3 aSeed;uniform float uTime;uniform float uScale;varying float life;varying float ember;
 void main(){life=fract(aSeed.x+uTime*(.45+.55*aSeed.y));ember=step(.83,aSeed.z);
 float a=aSeed.y*6.2831,r=(1.-life*.74)*sqrt(aSeed.z)*.32;
 vec3 p=vec3(cos(a)*r+sin(life*6.+a)*.09+life*life*.32,life*(.74+aSeed.z*.48)*(1.+ember*1.3),sin(a)*r+.04*cos(life*5.+a));
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uScale/max(1.,-mv.z)*mix(.25*(1.-life*.8),.034,ember);}`,
    fragmentShader: `varying float life;varying float ember;void main(){vec2 uv=(gl_PointCoord-.5)*2.;float r=length(uv*vec2(1.09,.78));float alpha=pow(max(0.,1.-r),1.45)*sin(min(life*7.,1.5708))*(1.-life);if(alpha<.012)discard;vec3 flame=mix(vec3(4.2,2.18,.42),vec3(3.3,.39,.025),smoothstep(.03,.85,life));gl_FragColor=vec4(flame,alpha);}`,
  });
  const flame = new T.Points(geom, material);
  flame.position.set(x, 1.17, z);
  flame.frustumCulled = false;
  scene.add(flame);
  const smokeTex = canvasTex(128, 128, (c) => {
    for (let i = 0; i < 90; i++) {
      const a = random() * Math.PI * 2,
        r = random() * 38,
        cx = 64 + Math.cos(a) * r,
        cy = 64 + Math.sin(a) * r,
        sz = 8 + random() * 18;
      let g = c.createRadialGradient(cx, cy, 0, cx, cy, sz);
      g.addColorStop(0, "rgba(183,178,164,.22)");
      g.addColorStop(1, "rgba(140,137,128,0)");
      c.fillStyle = g;
      c.fillRect(cx - sz, cy - sz, sz * 2, sz * 2);
    }
  });
  const puffs = Array.from({ length: 8 }, (_, i) => {
    const s = new T.Sprite(
      new T.SpriteMaterial({
        map: smokeTex,
        color: 0x77716c,
        transparent: true,
        depthWrite: false,
      }),
    );
    scene.add(s);
    return s;
  });
  const light = new T.PointLight(0xff8324, 23, 7, 2);
  light.position.set(x, 1.65, z);
  scene.add(light);
  return (t, h) => {
    material.uniforms.uTime.value = t;
    material.uniforms.uScale.value = h * 1.62;
    light.intensity = 23 + 4 * Math.sin(t * 11) + 3 * Math.sin(t * 17.5);
    puffs.forEach((s, i) => {
      let life = (t * 0.15 + i / 8) % 1;
      s.position.set(
        x + 0.18 + life * life * 1.08 + Math.sin(life * 5 + i) * 0.1,
        2 + life * 2.7,
        z + 0.1 * life,
      );
      s.scale.setScalar(0.57 + life * 1.6);
      s.material.opacity = Math.sin(life * Math.PI) * 0.19;
      s.material.rotation = life * 0.8 + i;
    });
  };
}

// A distant bank of low cloud follows the horizon even when the player looks straight up.
export function harborSky(scene) {
  const clouds = canvasTex(256, 256, (c, w, h) => {
    const image = c.createImageData(w, h);
    const layers = [4, 8, 16, 32, 64].map(n => ({
      n, values: Float32Array.from({ length: n * n }, () => random()),
    }));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let density = 0, weight = 0.52;
        for (const { n, values } of layers) {
          const u = x * n / w, v = y * n / h;
          const col = Math.floor(u), row = Math.floor(v);
          const a = T.MathUtils.smoothstep(u - col, 0, 1);
          const b = T.MathUtils.smoothstep(v - row, 0, 1);
          const next = (col + 1) % n, bottom = (row + 1) % n;
          const topRow = T.MathUtils.lerp(values[row * n + col], values[row * n + next], a);
          const lowRow = T.MathUtils.lerp(values[bottom * n + col], values[bottom * n + next], a);
          density += weight * T.MathUtils.lerp(topRow, lowRow, b);
          weight *= 0.5;
        }
        const i = (y * w + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = density * 255;
        image.data[i + 3] = 255;
      }
    }
    c.putImageData(image, 0, 0);
  });
  clouds.colorSpace = T.NoColorSpace;
  clouds.wrapS = clouds.wrapT = T.RepeatWrapping;
  const sky = new T.Mesh(new T.SphereGeometry(1, 28, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { clouds: { value: clouds } },
    vertexShader: `varying vec3 direction;
      void main() {
        direction = position;
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
        gl_Position = clip.xyww;
      }`,
    fragmentShader: `varying vec3 direction;
      uniform sampler2D clouds;
      void main() {
        vec3 ray = normalize(direction);
        float h = max(ray.y, 0.);
        float light = max(dot(ray, normalize(vec3(-19.,13.,-9.))), 0.);
        vec3 base = mix(vec3(.38,.40,.35), vec3(.14,.25,.32), smoothstep(0.,.85,h));
        base += vec3(.23,.13,.045) * pow(light, 6.);
        vec2 uv = ray.xz / (.30 + h) * vec2(.29,.43);
        float bank = smoothstep(.33,.68,texture2D(clouds,uv).r) * smoothstep(.012,.20,h);
        vec3 cloud = mix(vec3(.28,.32,.32), vec3(.74,.62,.47), pow(light, 3.));
        gl_FragColor = vec4(mix(base, cloud, bank * .78), 1.);
      }`,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);
}
