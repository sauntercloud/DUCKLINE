// Each control owns its pointer. Releasing one thumb leaves the other active.
export function bindDrag(element, { start, move, end }) {
  let owner = null;
  function release(e) {
    if (owner !== e.pointerId) return;
    owner = null;
    end();
  }
  element.addEventListener("pointerdown", (e) => {
    if (owner !== null || e.button !== 0 || start(e) === false) return;
    e.preventDefault();
    owner = e.pointerId;
    element.setPointerCapture(owner);
  });
  element.addEventListener("pointermove", (e) => {
    if (e.pointerId === owner) move(e);
  });
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("lostpointercapture", release);
  return () => {
    if (owner === null) return;
    const id = owner;
    owner = null;
    if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    end();
  };
}
