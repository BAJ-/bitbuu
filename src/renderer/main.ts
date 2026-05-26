import { createModel, getVoxel, setVoxel } from '../core/model';
import { createHistory } from '../core/history';
import { createPicker } from '../core/picking';
import { createCamera } from './camera';
import { mountPalette } from './palette';
import { createView } from './view';
import { mountPan } from './pan';

const canvasEl = document.getElementById('stage');
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('canvas#stage missing');
}
const paletteEl = document.getElementById('palette');
if (!(paletteEl instanceof HTMLElement)) {
  throw new Error('div#palette missing');
}
const canvas: HTMLCanvasElement = canvasEl;

const GRID = 32;
const INITIAL_SLOT = 11;
const model = createModel(GRID, GRID, GRID);
const c = GRID >> 1;
setVoxel(model, c, c, c, INITIAL_SLOT);

const picker = createPicker();
const history = createHistory();
const camera = createCamera();
const palette = mountPalette(paletteEl, model, INITIAL_SLOT);
const view = createView(canvas, model, camera);
const pan = mountPan(canvas, camera, view.draw);

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (e.deltaY < 0) camera.zoomIn();
    else camera.zoomOut();
    view.draw();
  },
  { passive: false },
);

canvas.addEventListener('click', (e) => {
  if (pan.isClickSuppressed()) return;
  const rect = canvas.getBoundingClientRect();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const hit = picker.pick(
    model,
    camera.forCanvas(w, h),
    w,
    h,
    e.clientX - rect.left,
    e.clientY - rect.top,
    view.currentDpr(),
  );
  if (!hit) return;
  const nx = hit.x + hit.nx;
  const ny = hit.y + hit.ny;
  const nz = hit.z + hit.nz;
  if (nx < 0 || ny < 0 || nz < 0 || nx >= model.sx || ny >= model.sy || nz >= model.sz) return;
  if (getVoxel(model, nx, ny, nz) !== 0) return;
  history.push(model.voxels);
  setVoxel(model, nx, ny, nz, palette.getActiveSlot());
  view.draw();
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (e.button !== 2) return;
  const rect = canvas.getBoundingClientRect();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const hit = picker.pick(
    model,
    camera.forCanvas(w, h),
    w,
    h,
    e.clientX - rect.left,
    e.clientY - rect.top,
    view.currentDpr(),
  );
  if (!hit) return;
  history.push(model.voxels);
  setVoxel(model, hit.x, hit.y, hit.z, 0);
  view.draw();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      pan.setSpaceHeld(true);
    }
  }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    const next = e.shiftKey ? history.redo(model.voxels) : history.undo(model.voxels);
    if (next) {
      model.voxels.set(next);
      view.draw();
    }
    return;
  }
  if (e.repeat) return;
  if (e.key === 'q' || e.key === 'Q') {
    camera.rotateBy(-1);
    view.draw();
  } else if (e.key === 'e' || e.key === 'E') {
    camera.rotateBy(1);
    view.draw();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') pan.setSpaceHeld(false);
});
window.addEventListener('blur', () => pan.setSpaceHeld(false));
window.addEventListener('resize', view.draw);

view.draw();
