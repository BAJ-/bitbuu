import type { Model } from './model';
import { createProjector, type Camera } from './render';

export interface GridBounds {
  minX: number;
  minY: number;
  minZ: number;
  // Max exclusive.
  maxX: number;
  maxY: number;
  maxZ: number;
}

// Occupied bbox padded one cell on every axis and clamped to the model. With no
// voxels the grid frames the single centre cell, yielding a 3x3x3 box that gives
// somewhere to place the first voxel.
export function gridBounds(m: Model): GridBounds {
  const { sx, sy, sz, voxels } = m;
  let minX = sx;
  let minY = sy;
  let minZ = sz;
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  let any = false;
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      const row = z * sx * sy + y * sx;
      for (let x = 0; x < sx; x++) {
        if (voxels[row + x]! === 0) continue;
        any = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x + 1 > maxX) maxX = x + 1;
        if (y + 1 > maxY) maxY = y + 1;
        if (z + 1 > maxZ) maxZ = z + 1;
      }
    }
  }
  if (!any) {
    const cx = Math.floor(sx / 2);
    const cy = Math.floor(sy / 2);
    const cz = Math.floor(sz / 2);
    minX = cx;
    minY = cy;
    minZ = cz;
    maxX = cx + 1;
    maxY = cy + 1;
    maxZ = cz + 1;
  }
  return {
    minX: Math.max(0, minX - 1),
    minY: Math.max(0, minY - 1),
    minZ: Math.max(0, minZ - 1),
    maxX: Math.min(sx, maxX + 1),
    maxY: Math.min(sy, maxY + 1),
    maxZ: Math.min(sz, maxZ + 1),
  };
}

export interface GridSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Emits the floor gridlines (at the box's bottom plane) and the 8 non-floor box
// edges (4 vertical, 4 top) as projected screen segments; the 4 bottom edges are
// the outermost floor lines. The GridSegment is reused across calls; callers
// must not retain it.
export function forEachGridSegment(m: Model, camera: Camera, cb: (s: GridSegment) => void): void {
  const b = gridBounds(m);
  const p = createProjector(m, camera);
  const seg: GridSegment = { x1: 0, y1: 0, x2: 0, y2: 0 };
  const emit = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
    p.project(ax, ay, az);
    seg.x1 = p.ox;
    seg.y1 = p.oy;
    p.project(bx, by, bz);
    seg.x2 = p.ox;
    seg.y2 = p.oy;
    cb(seg);
  };

  const z0 = b.minZ;
  for (let x = b.minX; x <= b.maxX; x++) emit(x, b.minY, z0, x, b.maxY, z0);
  for (let y = b.minY; y <= b.maxY; y++) emit(b.minX, y, z0, b.maxX, y, z0);

  emit(b.minX, b.minY, b.minZ, b.minX, b.minY, b.maxZ);
  emit(b.maxX, b.minY, b.minZ, b.maxX, b.minY, b.maxZ);
  emit(b.maxX, b.maxY, b.minZ, b.maxX, b.maxY, b.maxZ);
  emit(b.minX, b.maxY, b.minZ, b.minX, b.maxY, b.maxZ);

  emit(b.minX, b.minY, b.maxZ, b.maxX, b.minY, b.maxZ);
  emit(b.maxX, b.minY, b.maxZ, b.maxX, b.maxY, b.maxZ);
  emit(b.maxX, b.maxY, b.maxZ, b.minX, b.maxY, b.maxZ);
  emit(b.minX, b.maxY, b.maxZ, b.minX, b.minY, b.maxZ);
}

export interface FloorCell {
  // Cell the click resolves to (placement target).
  gx: number;
  gy: number;
  z: number;
  // Projected quad corners in winding order, in screen space.
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
}

// Emits every pickable floor cell on the box's bottom plane, with its projected
// quad. The FloorCell is reused across calls; callers must not retain it.
export function forEachFloorCell(m: Model, camera: Camera, cb: (c: FloorCell) => void): void {
  const b = gridBounds(m);
  const p = createProjector(m, camera);
  const z = b.minZ;
  const c: FloorCell = {
    gx: 0,
    gy: 0,
    z,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    x3: 0,
    y3: 0,
  };
  for (let gy = b.minY; gy < b.maxY; gy++) {
    for (let gx = b.minX; gx < b.maxX; gx++) {
      c.gx = gx;
      c.gy = gy;
      p.project(gx, gy, z);
      c.x0 = p.ox;
      c.y0 = p.oy;
      p.project(gx + 1, gy, z);
      c.x1 = p.ox;
      c.y1 = p.oy;
      p.project(gx + 1, gy + 1, z);
      c.x2 = p.ox;
      c.y2 = p.oy;
      p.project(gx, gy + 1, z);
      c.x3 = p.ox;
      c.y3 = p.oy;
      cb(c);
    }
  }
}
