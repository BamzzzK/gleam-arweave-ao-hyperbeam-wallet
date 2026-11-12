/**
 * Chrome draws the keyboard focus ring on a clicked button once its window
 * loses and regains focus. Dropping focus on blur when it came from a pointer
 * keeps the ring for keyboard users only. Text fields keep focus so typing
 * resumes where it was.
 */
export function releasePointerFocusOnBlur(win: Window = window): () => void {
  let pointerLast = false;
  const onPointer = () => {
    pointerLast = true;
  };
  const onKey = () => {
    pointerLast = false;
  };
  const onBlur = () => {
    const active = win.document.activeElement;
    if (!pointerLast || !(active instanceof HTMLElement)) return;
    if (active.matches("input, textarea, select, [contenteditable]")) return;
    active.blur();
  };
  win.addEventListener("pointerdown", onPointer, true);
  win.addEventListener("keydown", onKey, true);
  win.addEventListener("blur", onBlur);
  return () => {
    win.removeEventListener("pointerdown", onPointer, true);
    win.removeEventListener("keydown", onKey, true);
    win.removeEventListener("blur", onBlur);
  };
}
