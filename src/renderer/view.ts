import type { Model } from '../core/model';
import { render } from '../core/render';
import type { CameraController } from './camera';

const MAX_DPR = 2;
const BACKGROUND = '#1e1e1e';

export interface View {
  draw(): void;
  currentDpr(): number;
}

export function createView(
  canvas: HTMLCanvasElement,
  model: Model,
  camera: CameraController,
): View {
  const ctxOrNull = canvas.getContext('2d');
  if (!ctxOrNull) {
    throw new Error('2d context unavailable');
  }
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  function currentDpr(): number {
    return Math.min(window.devicePixelRatio || 1, MAX_DPR);
  }

  function draw(): void {
    const dpr = currentDpr();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const targetW = Math.floor(w * dpr);
    const targetH = Math.floor(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, w, h);
    render(model, camera.forCanvas(w, h), ctx);
  }

  return { draw, currentDpr };
}
