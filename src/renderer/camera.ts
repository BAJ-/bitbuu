import { PITCH_COUNT, PITCH_DEFAULT, type Camera, type Pitch, type Yaw } from '../core/render';

const ZOOM_MIN = 4;
const ZOOM_MAX = 96;
const ZOOM_STEP = 1.15;
const INITIAL_ZOOM = 48;

export interface CameraController {
  forCanvas(w: number, h: number): Camera;
  rotateBy(direction: 1 | -1): void;
  pitchBy(direction: 1 | -1): void;
  zoomIn(): void;
  zoomOut(): void;
  panBy(dx: number, dy: number): void;
}

export function createCamera(): CameraController {
  let yaw: Yaw = 0;
  let pitch: Pitch = PITCH_DEFAULT;
  let zoom = INITIAL_ZOOM;
  let panX = 0;
  let panY = 0;

  return {
    forCanvas(w, h) {
      return { yaw, pitch, zoom, panX: w / 2 + panX, panY: h / 2 + panY };
    },
    rotateBy(direction) {
      yaw = ((yaw + direction + 4) % 4) as Yaw;
    },
    pitchBy(direction) {
      pitch = (pitch + direction + PITCH_COUNT) % PITCH_COUNT;
    },
    zoomIn() {
      zoom = Math.min(ZOOM_MAX, zoom * ZOOM_STEP);
    },
    zoomOut() {
      zoom = Math.max(ZOOM_MIN, zoom / ZOOM_STEP);
    },
    panBy(dx, dy) {
      panX += dx;
      panY += dy;
    },
  };
}
