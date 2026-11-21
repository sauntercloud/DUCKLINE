import { MathUtils } from "three";

// Feet follow actual travel in the duck's local frame, independently of aim.
export function poseDuck(
  actor,
  dt,
  time,
  vx,
  vz,
  {
    search = false,
    extract = false,
    flinch = 0,
    back = 0,
    side = 0,
    kick = 0,
  } = {},
) {
  const { body, head, wings, legs, motion } = actor,
    heading = actor.root.rotation.y;
  const speed = Math.hypot(vx, vz),
    blend = 1 - Math.exp(-dt * 12);
  motion.speed = MathUtils.lerp(motion.speed, speed, blend);
  motion.phase += dt * (motion.speed * 2.3 + 3.1);
  const stride = Math.min(1, motion.speed / 2),
    run = Math.min(1, Math.max(0, (motion.speed - 3) / 2.6));
  const walk = Math.sin(motion.phase),
    bob = Math.cos(motion.phase * 2),
    breath = Math.sin(time * 2.15);
  const turn = Math.atan2(
    Math.sin(heading - motion.heading),
    Math.cos(heading - motion.heading),
  );
  motion.twist = MathUtils.clamp(
    motion.twist * Math.exp(-dt * 9) - turn,
    -0.5,
    0.5,
  );
  motion.heading = heading;
  motion.search = MathUtils.lerp(motion.search, Number(search), blend);
  motion.extract = MathUtils.lerp(motion.extract, Number(extract), blend);
  const work = motion.search,
    reach = Math.sin(time * 9);
  if (speed > 0.05) {
    motion.forward = (vx * Math.sin(heading) + vz * Math.cos(heading)) / speed;
    motion.side = (vx * Math.cos(heading) - vz * Math.sin(heading)) / speed;
  }
  body.position.set(
    walk * stride * 0.045,
    breath * 0.011 + (1 - bob) * 0.035 * stride - work * 0.18,
    run * 0.04,
  );
  body.rotation.set(
    0.11 * stride * motion.forward +
      run * 0.12 +
      work * 0.36 +
      flinch * back * 0.35 -
      kick * 0.32,
    motion.twist * 0.38 + walk * 0.065 * stride,
    walk * 0.088 * stride - motion.side * 0.1 * stride - flinch * side * 0.36,
  );
  head.rotation.set(
    -body.rotation.x * 0.52 + work * (0.33 + reach * 0.065) + breath * 0.015,
    -motion.twist * 0.46 +
      Math.sin(time * 1.12) * (0.07 + motion.extract * 0.33) +
      work * reach * 0.1,
    -body.rotation.z * 0.67,
  );
  head.position.z = 0.06 + 0.07 * stride * Math.sin(motion.phase * 2 - 0.5);
  for (let i = 0; i < 2; i++) {
    const sign = i === 0 ? -1 : 1,
      leg = legs[i],
      swing = walk * sign,
      lift = Math.max(0, -Math.cos(motion.phase) * sign) * stride;
    leg.position.set(
      sign * 0.19 + swing * motion.side * stride * 0.13,
      0.38 + lift * (0.14 + run * 0.085),
      0.045 + swing * motion.forward * stride * (0.12 + run * 0.05),
    );
    leg.rotation.set(
      -swing * stride * motion.forward * 0.5 - lift * 0.13,
      0,
      swing * stride * motion.side * 0.4,
    );
    wings[i].rotation.set(
      sign * walk * 0.14 * stride +
        (i === 0 ? work * (-0.54 + reach * 0.33) : work * 0.2) -
        kick * (i ? 0.85 : 0.42),
      sign * work * 0.14,
      sign * (run * 0.15 + flinch * 0.21),
    );
  }
}

export const magRelease = 0.22,
  magSeat = 0.77;

// Evaluated from the gameplay clock so pausing freezes the entire exchange.
export function poseLoadout(actor, selected, progress, kick) {
  const smooth = MathUtils.smoothstep;
  for (const [i, weapon] of [actor.gun, actor.pistol].entries()) {
    const t = i === selected ? progress : 0;
    const lift = smooth(t, 0, 0.2) * (1 - smooth(t, 0.8, 1));
    const { seated, removed, socket, tilt } = actor.magazines[i];
    weapon.position.set(
      0.355 - lift * 0.23,
      0.95 + lift * 0.17,
      (i ? 0.63 : 0.58) - kick * (i ? 0.74 : 0.8) + lift * 0.06,
    );
    weapon.rotation.set(
      (i ? 0 : 0.045) - kick * (i ? 1.45 : 0.9) - lift * (i ? 0.41 : 0.52),
      -0.37 * lift,
      -0.78 * lift,
    );
    seated.visible = t < magRelease || t >= 0.4;
    seated.position.copy(socket);
    seated.rotation.set(tilt, 0, 0);
    removed.visible = t >= magRelease && t < 0.6;
    if (removed.visible) {
      const drop = (t - magRelease) / (0.6 - magRelease);
      removed.position.copy(socket);
      removed.position.x -= drop * 0.37;
      removed.position.y -= drop * (0.35 + 0.69 * drop);
      removed.rotation.set(tilt + drop * 1.25, 0, drop * 0.46);
      removed.scale.setScalar(1 - smooth(t, 0.49, 0.6));
    }
    if (t >= 0.4 && t < magSeat) {
      const reach = 1 - smooth(t, 0.4, magSeat);
      seated.position.x -= reach * 0.43;
      seated.position.y -= reach * 0.44;
      seated.position.z -= reach * 0.23;
      seated.rotation.z = -reach * 0.66;
    }
    if (lift > 0) {
      const retrieve = smooth(t, 0.21, 0.44) * (1 - smooth(t, 0.49, magSeat));
      actor.head.rotation.x += 0.31 * lift;
      actor.head.rotation.y += 0.2 * lift;
      actor.wings[1].rotation.x -= 0.46 * lift;
      actor.wings[1].rotation.y -= 0.42 * lift;
      actor.wings[0].rotation.y += (1.04 - 0.84 * retrieve) * lift;
      actor.wings[0].rotation.x += (-0.61 + 0.89 * retrieve) * lift;
      actor.body.rotation.z -= 0.1 * lift;
    }
  }
}
