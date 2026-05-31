import type { Model } from '../core/model';
import { createProjector, render, PITCH_COUNT } from '../core/render';
import { floorInFront, gridBounds, roomPlanes } from '../core/grid';
import type { Camera, Yaw } from '../core/render';
import type { CameraController } from './camera';

const MAX_DPR = 2;
const BACKGROUND = '#1e1e1e';
const GRID_LINE = 'rgba(150, 190, 235, 0.40)';
const GRID_FLOOR_LINE = 'rgba(170, 205, 240, 0.50)';
const GRID_FLOOR_LINE_WIDTH = 1;
const GRID_TILE = 'rgba(58, 82, 116, 0.85)';
const GRID_TILE_LIGHT = 'rgba(74, 102, 140, 0.85)';
const GRID_TILE_DARK = 'rgba(40, 58, 84, 0.85)';
const GRID_SHADOW = 'rgba(0, 0, 0, 0.30)';
const GRID_EDGE = 'rgba(150, 195, 240, 0.75)';
const GRID_EDGE_WIDTH = 2;
const GRID_DROP = 'rgba(190, 215, 245, 0.85)';
const GRID_DROP_WIDTH = 1.5;
const GRID_AXIS = 'rgba(120, 150, 185, 0.30)';
const GRID_AXIS_WIDTH = 1.5;
const GRID_AXIS_EXT = 6;

// Model-space directions toward the camera's right and left at each yaw. The
// far (back) walls sit opposite these, so the wall picked for a direction is on
// the min side when the direction points +axis and the max side when it points
// -axis.
const YAW_RIGHT: Readonly<Record<Yaw, readonly [number, number]>> = {
  0: [1, 0],
  1: [0, -1],
  2: [-1, 0],
  3: [0, 1],
};

const YAW_LEFT: Readonly<Record<Yaw, readonly [number, number]>> = {
  0: [0, 1],
  1: [1, 0],
  2: [0, -1],
  3: [-1, 0],
};

export interface View {
  draw(): void;
  currentDpr(): number;
  toggleGrid(): boolean;
  isGridVisible(): boolean;
}

// Per-column occupancy of the model's footprint, indexed [x + y*sx]. Used to
// cast the model's silhouette onto the floor as a contact shadow.
function footprint(m: Model): Uint8Array {
  const { sx, sy, sz, voxels } = m;
  const fp = new Uint8Array(sx * sy);
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      const row = z * sx * sy + y * sx;
      for (let x = 0; x < sx; x++) {
        if (voxels[row + x]! !== 0) fp[x + y * sx] = 1;
      }
    }
  }
  return fp;
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

  let gridVisible = true;

  function currentDpr(): number {
    return Math.min(window.devicePixelRatio || 1, MAX_DPR);
  }

  // The floor is a flat sheet of unit quads on one Z plane: the model's bottom
  // face, padded one cell out in X/Y. Every corner goes through the same
  // projector as the voxels, so it shares their angle exactly.
  function drawFloor(cam: Camera): void {
    const b = gridBounds(model);
    const p = createProjector(model, cam);
    const { floorZ } = roomPlanes(model);

    ctx.fillStyle = GRID_TILE;
    for (let y = b.minY; y < b.maxY; y++) {
      for (let x = b.minX; x < b.maxX; x++) {
        p.project(x, y, floorZ);
        const x0 = p.ox;
        const y0 = p.oy;
        p.project(x + 1, y, floorZ);
        const x1 = p.ox;
        const y1 = p.oy;
        p.project(x + 1, y + 1, floorZ);
        const x2 = p.ox;
        const y2 = p.oy;
        p.project(x, y + 1, floorZ);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(p.ox, p.oy);
        ctx.closePath();
        ctx.fill();
      }
    }

    const fp = footprint(model);
    ctx.fillStyle = GRID_SHADOW;
    for (let y = b.minY; y < b.maxY; y++) {
      for (let x = b.minX; x < b.maxX; x++) {
        if (fp[x + y * model.sx] !== 1) continue;
        p.project(x, y, floorZ);
        const x0 = p.ox;
        const y0 = p.oy;
        p.project(x + 1, y, floorZ);
        const x1 = p.ox;
        const y1 = p.oy;
        p.project(x + 1, y + 1, floorZ);
        const x2 = p.ox;
        const y2 = p.oy;
        p.project(x, y + 1, floorZ);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(p.ox, p.oy);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.strokeStyle = GRID_FLOOR_LINE;
    ctx.lineWidth = GRID_FLOOR_LINE_WIDTH;
    ctx.beginPath();
    for (let y = b.minY; y <= b.maxY; y++) {
      p.project(b.minX, y, floorZ);
      const x1 = p.ox;
      const y1 = p.oy;
      p.project(b.maxX, y, floorZ);
      ctx.moveTo(x1, y1);
      ctx.lineTo(p.ox, p.oy);
    }
    for (let x = b.minX; x <= b.maxX; x++) {
      p.project(x, b.minY, floorZ);
      const x1 = p.ox;
      const y1 = p.oy;
      p.project(x, b.maxY, floorZ);
      ctx.moveTo(x1, y1);
      ctx.lineTo(p.ox, p.oy);
    }
    ctx.stroke();

    ctx.strokeStyle = GRID_EDGE;
    ctx.lineWidth = GRID_EDGE_WIDTH;
    ctx.beginPath();
    p.project(b.minX, b.minY, floorZ);
    ctx.moveTo(p.ox, p.oy);
    p.project(b.maxX, b.minY, floorZ);
    ctx.lineTo(p.ox, p.oy);
    p.project(b.maxX, b.maxY, floorZ);
    ctx.lineTo(p.ox, p.oy);
    p.project(b.minX, b.maxY, floorZ);
    ctx.lineTo(p.ox, p.oy);
    ctx.closePath();
    ctx.stroke();

    // Vertical posts at the model's bounding corners, clipped to each corner
    // column's actually occupied voxels (empty corners get no post). Z maps only
    // to screen-Y, so these render as true vertical lines: an orientation-proof
    // cue that the eye reads as the up axis even when the room is upside down.
    const occMinX = b.minX === 0 ? 0 : b.minX + 1;
    const occMaxX = b.maxX === model.sx ? model.sx : b.maxX - 1;
    const occMinY = b.minY === 0 ? 0 : b.minY + 1;
    const occMaxY = b.maxY === model.sy ? model.sy : b.maxY - 1;
    const { sx, sy, voxels } = model;
    ctx.strokeStyle = GRID_DROP;
    ctx.lineWidth = GRID_DROP_WIDTH;
    ctx.beginPath();
    // Each corner of the floor maps to the voxel column just inside it.
    const post = (cornerX: number, cornerY: number, vx: number, vy: number): void => {
      let zlo = -1;
      let zhi = -1;
      for (let z = 0; z < model.sz; z++) {
        if (voxels[vx + vy * sx + z * sx * sy]! === 0) continue;
        if (zlo === -1) zlo = z;
        zhi = z + 1;
      }
      if (zlo === -1) return;
      p.project(cornerX, cornerY, zlo);
      const x1 = p.ox;
      const y1 = p.oy;
      p.project(cornerX, cornerY, zhi);
      ctx.moveTo(x1, y1);
      ctx.lineTo(p.ox, p.oy);
    };
    post(occMinX, occMinY, occMinX, occMinY);
    post(occMaxX, occMinY, occMaxX - 1, occMinY);
    post(occMaxX, occMaxY, occMaxX - 1, occMaxY - 1);
    post(occMinX, occMaxY, occMinX, occMaxY - 1);
    ctx.stroke();
  }

  // The two walls rise from the floor's far edges (the back pair, chosen by yaw
  // alone since the walls are vertical). Each of the camera's right/left
  // directions picks one wall on the opposite side of the box.
  function drawWalls(cam: Camera): void {
    const b = gridBounds(model);
    const p = createProjector(model, cam);
    const { floorZ, topZ } = roomPlanes(model);

    const right = YAW_RIGHT[cam.yaw];
    const left = YAW_LEFT[cam.yaw];
    const xDir = right[0] !== 0 ? right : left;
    const yDir = right[1] !== 0 ? right : left;
    const wallX = xDir[0] === 1 ? b.minX : b.maxX;
    const wallY = yDir[1] === 1 ? b.minY : b.maxY;

    // Light the walls like the model: the face along the camera's left catches
    // more light than the one along its right (model LEFT 0.78 vs RIGHT 0.58).
    const xWallTile = xDir === left ? GRID_TILE_LIGHT : GRID_TILE_DARK;
    const yWallTile = yDir === left ? GRID_TILE_LIGHT : GRID_TILE_DARK;

    const fillTile = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      cx: number,
      cy: number,
      cz: number,
      dx: number,
      dy: number,
      dz: number,
    ): void => {
      p.project(ax, ay, az);
      const x0 = p.ox;
      const y0 = p.oy;
      p.project(bx, by, bz);
      const x1 = p.ox;
      const y1 = p.oy;
      p.project(cx, cy, cz);
      const x2 = p.ox;
      const y2 = p.oy;
      p.project(dx, dy, dz);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(p.ox, p.oy);
      ctx.closePath();
      ctx.fill();
    };

    ctx.fillStyle = xWallTile;
    for (let z = floorZ; z < topZ; z++) {
      for (let y = b.minY; y < b.maxY; y++) {
        fillTile(wallX, y, z, wallX, y + 1, z, wallX, y + 1, z + 1, wallX, y, z + 1);
      }
    }
    ctx.fillStyle = yWallTile;
    for (let z = floorZ; z < topZ; z++) {
      for (let x = b.minX; x < b.maxX; x++) {
        fillTile(x, wallY, z, x + 1, wallY, z, x + 1, wallY, z + 1, x, wallY, z + 1);
      }
    }

    const line = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
      p.project(ax, ay, az);
      const x1 = p.ox;
      const y1 = p.oy;
      p.project(bx, by, bz);
      ctx.moveTo(x1, y1);
      ctx.lineTo(p.ox, p.oy);
    };

    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let z = floorZ; z <= topZ; z++) {
      line(wallX, b.minY, z, wallX, b.maxY, z);
      line(b.minX, wallY, z, b.maxX, wallY, z);
    }
    for (let y = b.minY; y <= b.maxY; y++) {
      line(wallX, y, floorZ, wallX, y, topZ);
    }
    for (let x = b.minX; x <= b.maxX; x++) {
      line(x, wallY, floorZ, x, wallY, topZ);
    }
    ctx.stroke();

    ctx.strokeStyle = GRID_EDGE;
    ctx.lineWidth = GRID_EDGE_WIDTH;
    ctx.beginPath();
    line(wallX, b.minY, topZ, wallX, b.maxY, topZ);
    line(b.minX, wallY, topZ, b.maxX, wallY, topZ);
    line(wallX, b.minY, floorZ, wallX, b.minY, topZ);
    line(wallX, b.maxY, floorZ, wallX, b.maxY, topZ);
    line(b.minX, wallY, floorZ, b.minX, wallY, topZ);
    line(b.maxX, wallY, floorZ, b.maxX, wallY, topZ);
    ctx.stroke();
  }

  // The vertical back walls are behind the model when the camera is on the front
  // side (cos(theta) > 0, pitches 0,1,7) and swing in front once it tilts over
  // the top (cos(theta) < 0, pitches 3,4,5).
  function wallsInFront(cam: Camera): boolean {
    const pIdx = (((cam.pitch % PITCH_COUNT) + PITCH_COUNT) % PITCH_COUNT) | 0;
    return pIdx >= 3 && pIdx <= 5;
  }

  // Three faint rays from the room's shared back-bottom corner reaching out into
  // empty space: two along the floor axes and one straight down. A persistent
  // world frame that extends past the room so the scene's orientation stays
  // legible even when the box itself reads ambiguously.
  function drawAxes(cam: Camera): void {
    const b = gridBounds(model);
    const p = createProjector(model, cam);
    const { floorZ } = roomPlanes(model);

    const right = YAW_RIGHT[cam.yaw];
    const left = YAW_LEFT[cam.yaw];
    const xDir = right[0] !== 0 ? right : left;
    const yDir = right[1] !== 0 ? right : left;
    const cornerX = xDir[0] === 1 ? b.minX : b.maxX;
    const cornerY = yDir[1] === 1 ? b.minY : b.maxY;
    const xOut = cornerX === b.minX ? cornerX + GRID_AXIS_EXT : cornerX - GRID_AXIS_EXT;
    const yOut = cornerY === b.minY ? cornerY + GRID_AXIS_EXT : cornerY - GRID_AXIS_EXT;
    const zOut = floorZ + GRID_AXIS_EXT;

    ctx.strokeStyle = GRID_AXIS;
    ctx.lineWidth = GRID_AXIS_WIDTH;
    ctx.beginPath();
    const ray = (x: number, y: number, z: number): void => {
      p.project(cornerX, cornerY, floorZ);
      const x1 = p.ox;
      const y1 = p.oy;
      p.project(x, y, z);
      ctx.moveTo(x1, y1);
      ctx.lineTo(p.ox, p.oy);
    };
    ray(xOut, cornerY, floorZ);
    ray(cornerX, yOut, floorZ);
    ray(cornerX, cornerY, zOut);
    ctx.stroke();
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
    const cam = camera.forCanvas(w, h);
    if (gridVisible) {
      drawAxes(cam);
      if (!floorInFront(cam)) drawFloor(cam);
      if (!wallsInFront(cam)) drawWalls(cam);
      render(model, cam, ctx);
      if (wallsInFront(cam)) drawWalls(cam);
      if (floorInFront(cam)) drawFloor(cam);
    } else {
      render(model, cam, ctx);
    }
  }

  function toggleGrid(): boolean {
    gridVisible = !gridVisible;
    draw();
    return gridVisible;
  }

  function isGridVisible(): boolean {
    return gridVisible;
  }

  return { draw, currentDpr, toggleGrid, isGridVisible };
}
