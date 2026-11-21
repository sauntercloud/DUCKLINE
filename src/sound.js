// Short, cached mono samples are mixed at their in-game positions. The distant
// reflection uses a separate envelope so rapid fire retains a distinct attack.
const voices = {
  rubble: { duration: 0.26, low: 122, snap: 0.014, tail: 0.071, ring: 503 },
  rifle: { duration: 0.39, low: 105, snap: 0.018, tail: 0.084, ring: 690 },
  pistol: { duration: 0.25, low: 165, snap: 0.011, tail: 0.048, ring: 1120 },
  metal: { duration: 0.27, low: 620, snap: 0.008, tail: 0.031, ring: 2250 },
  wood: { duration: 0.125, low: 180, snap: 0.012, tail: 0.023, ring: 370 },
  stone: { duration: 0.15, low: 240, snap: 0.018, tail: 0.037, ring: 510 },
  armor: { duration: 0.24, low: 138, snap: 0.013, tail: 0.045, ring: 890 },
  latch: { duration: 0.12, low: 350, snap: 0.007, tail: 0.024, ring: 1400 },
};

// Render the report once. Reflections use delayed, softened copies of the actual
// transient so their timing and timbre remain related to the initial crack.
function breachReport(ctx) {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(2, Math.ceil(rate * 2.85), rate);
  const direct = new Float32Array(buffer.length);
  let bass = 0, mid = 0, phase = 0, rumble = 0;
  const coefficient = hz => 1 - Math.exp(-2 * Math.PI * hz / rate);
  const lowpass = coefficient(175), band = coefficient(840), sub = coefficient(78);
  for (let i = 0; i < direct.length; i++) {
    const t = i / rate, noise = Math.random() * 2 - 1;
    mid += band * (noise - mid);
    bass += lowpass * (noise - bass);
    rumble += sub * (noise - rumble);
    phase += 2 * Math.PI * (34 + 45 * Math.exp(-t / 0.10)) / rate;
    const crack = (noise - mid) * 0.28 * Math.exp(-t / 0.015);
    const roar = (mid - bass) * 0.95 * Math.exp(-t / 0.23);
    // A short upper harmonic carries the impact on smaller speakers.
    const body = Math.sin(phase) + 0.21 * Math.sin(2 * phase) * Math.exp(-t / 0.22);
    const boom = (body * 0.9 + bass * 3.8) * Math.exp(-t / 0.46);
    const tail = rumble * 5.2 * Math.exp(-t / 0.83);
    direct[i] = Math.tanh(crack + roar + boom + tail) * Math.min(1, t / 0.004);
  }
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    const echoes = (ch ? [0.109, 0.247, 0.419] : [0.085, 0.278, 0.374])
      .map(seconds => Math.round(seconds * rate));
    let wash = 0;
    for (let i = 0; i < data.length; i++) {
      const reflected = 0.34 * (direct[i - echoes[0]] || 0)
        + 0.19 * (direct[i - echoes[1]] || 0) + 0.12 * (direct[i - echoes[2]] || 0);
      wash += band * (reflected - wash);
      data[i] = 0.94 * Math.tanh(direct[i] * 1.15 + wash)
        * Math.min(1, (data.length - i - 1) / (rate * 0.05));
    }
  }
  return buffer;
}

export function createSound() {
  let ctx,
    master,
    level = 0.72,
    enabled = true;
  const buffers = new Map();
  function configure(on, volume) {
    enabled = on;
    level = volume;
    if (master)
      master.gain.setTargetAtTime(enabled ? level : 0, ctx.currentTime, 0.008);
  }
  function unlock() {
    if (!enabled) return;
    if (!ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      ctx = new Context();
      master = ctx.createGain();
      master.gain.value = level;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 5;
      master.connect(limiter);
      limiter.connect(ctx.destination);
      sample("blast");
    }
    if (ctx.state !== "running") ctx.resume().catch(() => {});
  }
  function sample(kind) {
    if (buffers.has(kind)) return buffers.get(kind);
    if (kind === "blast") {
      const buffer = breachReport(ctx);
      buffers.set(kind, buffer);
      return buffer;
    }
    const v = voices[kind],
      gun = kind === "rifle" || kind === "pistol";
    const buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * v.duration),
      ctx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    let soft = 0,
      phase = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate,
        n = Math.random() * 2 - 1;
      soft += (n - soft) * (gun ? 0.15 : 0.26);
      phase +=
        (2 * Math.PI * v.low * (0.48 + 1.52 * Math.exp(-t / 0.019))) /
        ctx.sampleRate;
      const crack = (n - soft) * Math.exp(-t / v.snap) * 0.63;
      const body = Math.sin(phase) * Math.exp(-t / v.tail) * 0.53;
      const ring =
        Math.sin(2 * Math.PI * v.ring * t) *
        Math.exp(-t / (kind === "metal" ? 0.068 : 0.012)) *
        0.19;
      const echoTime = t - 0.064;
      const echo =
        gun && echoTime > 0
          ? soft * Math.exp(-echoTime / (v.tail * 0.95)) * 0.54
          : 0;
      data[i] =
        Math.tanh(crack + body + ring + soft * Math.exp(-t / v.tail) + echo) *
        Math.min(1, t / 0.0006);
    }
    buffers.set(kind, buffer);
    return buffer;
  }
  function play(kind, { pan = 0, distance = 0, gain = 1 } = {}) {
    if (!enabled || !ctx) return;
    const source = ctx.createBufferSource(),
      levelNode = ctx.createGain(),
      panner = ctx.createStereoPanner();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 14000 / (1 + distance * 0.1);
    source.buffer = sample(kind);
    source.playbackRate.value = 0.965 + Math.random() * 0.07;
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    levelNode.gain.value = gain / (1 + distance * (kind === "blast" ? 0.045 : 0.12));
    source.connect(filter);
    filter.connect(levelNode);
    levelNode.connect(panner);
    panner.connect(master);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      levelNode.disconnect();
      panner.disconnect();
    };
    source.start();
  }
  function tone(
    freq,
    duration = 0.1,
    type = "sine",
    volume = 0.05,
    fall = 0.4,
  ) {
    if (!enabled || !ctx) return;
    const o = ctx.createOscillator(),
      g = ctx.createGain(),
      now = ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(freq * fall, now + duration);
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(now + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  return { configure, unlock, play, tone };
}
