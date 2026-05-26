import type { CameraController } from './camera';

export interface PanController {
  setSpaceHeld(held: boolean): void;
  isClickSuppressed(): boolean;
}

export function mountPan(
  canvas: HTMLCanvasElement,
  camera: CameraController,
  onChange: () => void,
): PanController {
  let lastX = 0;
  let lastY = 0;
  let active = false;
  let suppressClick = false;
  let spaceHeld = false;
  let activeButton: 0 | 1 | null = null;

  function updateCursor(): void {
    canvas.style.cursor = active ? 'grabbing' : spaceHeld ? 'grab' : '';
  }

  canvas.addEventListener('pointerdown', (e) => {
    const isMiddle = e.button === 1;
    const isSpaceLeft = e.button === 0 && spaceHeld;
    if (!isMiddle && !isSpaceLeft) return;
    e.preventDefault();
    active = true;
    suppressClick = false;
    activeButton = e.button as 0 | 1;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    updateCursor();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (dx === 0 && dy === 0) return;
    camera.panBy(dx, dy);
    lastX = e.clientX;
    lastY = e.clientY;
    if (activeButton === 0) {
      suppressClick = true;
    }
    onChange();
  });

  function end(e: PointerEvent): void {
    if (!active) return;
    active = false;
    activeButton = null;
    canvas.releasePointerCapture(e.pointerId);
    updateCursor();
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return {
    setSpaceHeld(held) {
      if (spaceHeld === held) return;
      spaceHeld = held;
      updateCursor();
    },
    isClickSuppressed() {
      if (!suppressClick) return false;
      suppressClick = false;
      return true;
    },
  };
}
