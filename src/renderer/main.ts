import { createModel, getVoxel, setVoxel } from '../core/model';
import { createPicker } from '../core/picking';
import { render, type Camera, type Yaw } from '../core/render';

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

const picker = createPicker();

const ZOOM_MIN = 4;
const ZOOM_MAX = 96;
const ZOOM_STEP = 1.15;
let zoom = 48;
let yaw: Yaw = 0;

function cameraFor(w: number, h: number): Camera {
  return { yaw, zoom, panX: w / 2, panY: h / 2 };
}

function draw(): void {
  if (!(canvas instanceof HTMLCanvasElement) || !ctx) return;
  const dpr = currentDpr();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, w, h);
  render(model, cameraFor(w, h), ctx);
}

function currentDpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
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

canvas.addEventListener('click', (e) => {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const hit = picker.pick(model, cameraFor(w, h), w, h, px, py, currentDpr());
  if (!hit) return;
  const nx = hit.x + hit.nx;
  const ny = hit.y + hit.ny;
  const nz = hit.z + hit.nz;
  if (nx < 0 || ny < 0 || nz < 0 || nx >= model.sx || ny >= model.sy || nz >= model.sz) return;
  if (getVoxel(model, nx, ny, nz) !== 0) return;
  setVoxel(model, nx, ny, nz, 1);
  draw();
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'q' || e.key === 'Q') {
    yaw = ((yaw + 3) % 4) as Yaw;
    draw();
  } else if (e.key === 'e' || e.key === 'E') {
    yaw = ((yaw + 1) % 4) as Yaw;
    draw();
  }
});

window.addEventListener('resize', draw);
draw();
