import { createModel, setVoxel } from '../core/model';
import { render, type Camera } from '../core/render';

const canvas = document.getElementById('stage');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('canvas#stage missing');
}
const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('2d context unavailable');
}

const GRID = 32;
const model = createModel(GRID, GRID, GRID);
// Override palette slot 1 with main colour until a real palette UI exists.
model.palette[4] = 0xd0;
model.palette[5] = 0xe9;
model.palette[6] = 0xc0;
model.palette[7] = 0xff;
const c = GRID >> 1;
setVoxel(model, c, c, c, 1);

const ZOOM_MIN = 4;
const ZOOM_MAX = 96;
const ZOOM_STEP = 1.15;
let zoom = 48;

function draw(): void {
  if (!(canvas instanceof HTMLCanvasElement) || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, w, h);

  // Centre on the placed voxel: a voxel at (a,b,c) projects to
  // ((a-b)*zoom + panX, (a+b)*zoom/2 - c*zoom + panY). With a=b=c the first
  // term is 0 and the second simplifies to 0, so the voxel's centre lands at
  // (panX, panY). Math...
  const camera: Camera = {
    yaw: 0,
    zoom,
    panX: w / 2,
    panY: h / 2,
  };
  render(model, camera, ctx);
}

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
    if (next === zoom) return;
    zoom = next;
    draw();
  },
  { passive: false },
);

window.addEventListener('resize', draw);
draw();
