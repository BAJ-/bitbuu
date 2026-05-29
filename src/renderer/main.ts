import { createModel, DEFAULT_PALETTE, getVoxel, setVoxel } from '../core/model';
import { createHistory } from '../core/history';
import { createPicker } from '../core/picking';
import { decodeModel, encodeModel } from '../core/io';
import { createCamera } from './camera';
import { mountMenu } from './menu';
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
let history = createHistory();
const camera = createCamera();
const palette = mountPalette(paletteEl, model, INITIAL_SLOT);
const view = createView(canvas, model, camera);
const pan = mountPan(canvas, camera, view.draw);
let dirty = false;
let closeInFlight = false;

async function save(): Promise<boolean> {
  const bytes = encodeModel(model, history);
  const result = await window.bitbuu.saveModel(bytes);
  if (result.canceled) return false;
  dirty = false;
  return true;
}

async function open(): Promise<void> {
  const result = await window.bitbuu.openModel();
  if (result.canceled || !result.bytes) return;
  let decoded;
  try {
    decoded = decodeModel(result.bytes);
  } catch (err) {
    window.alert(`Could not open file: ${(err as Error).message}`);
    return;
  }
  if (
    decoded.model.sx !== model.sx ||
    decoded.model.sy !== model.sy ||
    decoded.model.sz !== model.sz
  ) {
    window.alert(
      `Could not open file: dimensions ${decoded.model.sx}x${decoded.model.sy}x${decoded.model.sz} do not match current ${model.sx}x${model.sy}x${model.sz}.`,
    );
    return;
  }
  model.voxels.set(decoded.model.voxels);
  model.palette.set(decoded.model.palette);
  history = createHistory({ undo: decoded.history.undo, redo: decoded.history.redo });
  palette.refresh();
  dirty = false;
  view.draw();
}

async function newModel(): Promise<void> {
  if (dirty) {
    const choice = await window.bitbuu.confirmDiscard();
    if (choice === 'cancel') return;
    if (choice === 'save') {
      const saved = await save();
      if (!saved) return;
    }
  }
  model.voxels.fill(0);
  model.palette.set(DEFAULT_PALETTE);
  setVoxel(model, c, c, c, INITIAL_SLOT);
  history = createHistory();
  palette.refresh();
  dirty = false;
  view.draw();
}

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
  dirty = true;
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
  dirty = true;
  view.draw();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    if (
      !(
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
    ) {
      e.preventDefault();
      pan.setSpaceHeld(true);
    }
  }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    const next = e.shiftKey ? history.redo(model.voxels) : history.undo(model.voxels);
    if (next) {
      model.voxels.set(next);
      dirty = true;
      view.draw();
    }
    return;
  }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    void save();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    void open();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    void newModel();
    return;
  }
  if (e.repeat) return;
  if (e.key === 'q' || e.key === 'Q') {
    camera.rotateBy(-1);
    view.draw();
  } else if (e.key === 'e' || e.key === 'E') {
    camera.rotateBy(1);
    view.draw();
  } else if (e.key === 'w' || e.key === 'W') {
    camera.pitchBy(1);
    view.draw();
  } else if (e.key === 's' || e.key === 'S') {
    camera.pitchBy(-1);
    view.draw();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') pan.setSpaceHeld(false);
});
window.addEventListener('blur', () => pan.setSpaceHeld(false));
window.addEventListener('resize', view.draw);

window.bitbuu.onCloseRequested(() => {
  void handleCloseRequest();
});

const modKey = window.bitbuu.platform === 'darwin' ? '⌘' : 'Ctrl+';
mountMenu(
  document.getElementById('menu-toggle') as HTMLButtonElement,
  document.getElementById('drawer') as HTMLElement,
  [
    { label: 'New', shortcut: `${modKey}N`, onClick: () => void newModel() },
    { label: 'Open…', shortcut: `${modKey}O`, onClick: () => void open() },
    { label: 'Save…', shortcut: `${modKey}S`, onClick: () => void save() },
  ],
);

async function handleCloseRequest(): Promise<void> {
  if (closeInFlight) return;
  closeInFlight = true;
  try {
    if (!dirty) {
      await window.bitbuu.forceClose();
      return;
    }
    const choice = await window.bitbuu.confirmDiscard();
    if (choice === 'cancel') return;
    if (choice === 'discard') {
      await window.bitbuu.forceClose();
      return;
    }
    const saved = await save();
    if (!saved) return;
    await window.bitbuu.forceClose();
  } finally {
    closeInFlight = false;
  }
}

view.draw();
