// Only contacts that begin on the scene participate in orbit and pinch.
// The movement and firing controls keep ownership of their own pointers.
export function bindCameraInput(canvas, { enabled, mouseDrag, rotate, zoom, start, beginFire, endFire }) {
  const fingers = new Map();
  let holdId = null, holdTimer = null;
  function cancelHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    if (holdId !== null) endFire();
    holdId = null;
  }
  let pinch = 0,
    safariScale = 0;
  function separation() {
    const [a, b] = fingers.values();
    return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (
      !enabled() ||
      (e.pointerType !== "touch" && (!mouseDrag() || e.button !== 2)) ||
      fingers.size >= 2
    )
      return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
      cancelHold();
      pinch = separation();
    } else if (e.pointerType === "touch") {
      const r = canvas.getBoundingClientRect();
      if (e.clientX >= r.left + r.width / 2) {
        holdId = e.pointerId;
        const origin = fingers.get(holdId);
        origin.startX = origin.x;
        origin.startY = origin.y;
        holdTimer = setTimeout(() => {
          holdTimer = null;
          if (enabled()) beginFire();
        }, 300);
      }
    }
    start();
  });
  canvas.addEventListener("pointermove", (e) => {
    const previous = fingers.get(e.pointerId);
    if (!previous) return;
    const dx = e.clientX - previous.x,
      dy = e.clientY - previous.y;
    previous.x = e.clientX;
    previous.y = e.clientY;
    if (holdTimer !== null && holdId === e.pointerId &&
        Math.hypot(e.clientX - previous.startX, e.clientY - previous.startY) > 9)
      cancelHold();
    if (fingers.size === 2) {
      const next = separation();
      zoom(pinch / next);
      pinch = next;
    } else rotate(dx, dy);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(event, (e) => {
      fingers.delete(e.pointerId);
      if (e.pointerId === holdId) cancelHold();
    });
  }
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!enabled() || e.metaKey) return;
      e.preventDefault();
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
      if (e.ctrlKey) {
        if (!safariScale)
          zoom(Math.exp(Math.max(-1, Math.min(1, e.deltaY * unit * 0.012))));
      } else rotate(e.deltaX * unit, e.deltaY * unit);
    },
    { passive: false },
  );
  // Safari on a Mac reports the trackpad pinch as a gesture event.
  canvas.addEventListener(
    "gesturestart",
    (e) => {
      if (enabled()) {
        e.preventDefault();
        safariScale = e.scale || 1;
      }
    },
    { passive: false },
  );
  canvas.addEventListener(
    "gesturechange",
    (e) => {
      if (!safariScale) return;
      e.preventDefault();
      if (fingers.size < 2 && e.scale > 0) zoom(safariScale / e.scale);
      safariScale = e.scale;
    },
    { passive: false },
  );
  canvas.addEventListener(
    "gestureend",
    (e) => {
      if (safariScale) e.preventDefault();
      safariScale = 0;
    },
    { passive: false },
  );
  return () => {
    cancelHold();
    for (const id of fingers.keys())
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    fingers.clear();
    safariScale = 0;
  };
}
