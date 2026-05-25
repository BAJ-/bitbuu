import type { Model } from './model';

export type Yaw = 0 | 1 | 2 | 3;

export interface Camera {
  yaw: Yaw;
  // Pixels per voxel along the screen-horizontal half-axis. One voxel projects
  // to a hexagon 2*zoom wide and 2*zoom tall.
  zoom: number;
  panX: number;
  panY: number;
}

const SHADE_TOP = 1.0;
const SHADE_LEFT = 0.78;
const SHADE_RIGHT = 0.58;

function voxelAt(m: Model, x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0 || x >= m.sx || y >= m.sy || z >= m.sz) return 0;
  return m.voxels[x + y * m.sx + z * m.sx * m.sy]!;
}

function fillStyleFor(m: Model, v: number, shade: number): string {
  const o = v * 4;
  const r = Math.round(m.palette[o]! * shade);
  const g = Math.round(m.palette[o + 1]! * shade);
  const b = Math.round(m.palette[o + 2]! * shade);
  return `rgb(${r},${g},${b})`;
}

// Per-yaw configuration. For each yaw we need:
//   rotate:    (x,y) in model coords -> (x',y') in screen-aligned coords
//   stepX/Y:   iteration direction in model coords that yields ascending
//              (x',y'), which is the painter's-algorithm order
//   right/left: (dx,dy) offset in model coords to the neighbour that occludes
//              the right (+X') and left (+Y') visible side faces.
// The top face is always +z; geometry of the three drawn parallelograms is
// identical for every yaw — only iteration order and occluders change.
interface YawConfig {
  rotate: (x: number, y: number, sx: number, sy: number) => readonly [number, number];
  stepX: 1 | -1;
  stepY: 1 | -1;
  right: readonly [number, number];
  left: readonly [number, number];
}

const YAWS: readonly [YawConfig, YawConfig, YawConfig, YawConfig] = [
  {
    rotate: (x, y) => [x, y],
    stepX: 1,
    stepY: 1,
    right: [1, 0],
    left: [0, 1],
  },
  {
    rotate: (x, y, _sx, sy) => [sy - 1 - y, x],
    stepX: 1,
    stepY: -1,
    right: [0, -1],
    left: [1, 0],
  },
  {
    rotate: (x, y, sx, sy) => [sx - 1 - x, sy - 1 - y],
    stepX: -1,
    stepY: -1,
    right: [-1, 0],
    left: [0, -1],
  },
  {
    rotate: (x, y, sx) => [y, sx - 1 - x],
    stepX: -1,
    stepY: 1,
    right: [0, 1],
    left: [-1, 0],
  },
];

export function render(m: Model, camera: Camera, ctx: CanvasRenderingContext2D): void {
  const cfg = YAWS[camera.yaw];
  const cell = camera.zoom;
  const halfH = cell / 2;

  const startX = cfg.stepX > 0 ? 0 : m.sx - 1;
  const endX = cfg.stepX > 0 ? m.sx : -1;
  const startY = cfg.stepY > 0 ? 0 : m.sy - 1;
  const endY = cfg.stepY > 0 ? m.sy : -1;

  const [rdx, rdy] = cfg.right;
  const [ldx, ldy] = cfg.left;

  for (let z = 0; z < m.sz; z++) {
    for (let y = startY; y !== endY; y += cfg.stepY) {
      for (let x = startX; x !== endX; x += cfg.stepX) {
        const v = voxelAt(m, x, y, z);
        if (v === 0) continue;

        const rightN = voxelAt(m, x + rdx, y + rdy, z);
        const leftN = voxelAt(m, x + ldx, y + ldy, z);
        const topN = voxelAt(m, x, y, z + 1);

        // Buried voxels contribute nothing on screen — skip the per-face work.
        if (
          rightN !== 0 &&
          leftN !== 0 &&
          topN !== 0 &&
          voxelAt(m, x - rdx, y - rdy, z) !== 0 &&
          voxelAt(m, x - ldx, y - ldy, z) !== 0 &&
          voxelAt(m, x, y, z - 1) !== 0
        ) {
          continue;
        }

        const [rx, ry] = cfg.rotate(x, y, m.sx, m.sy);
        const ox = (rx - ry) * cell + camera.panX;
        const oy = (rx + ry) * halfH - z * cell + camera.panY;

        // Top face (+z): hidden by the voxel directly above.
        if (topN === 0) {
          ctx.fillStyle = fillStyleFor(m, v, SHADE_TOP);
          ctx.beginPath();
          ctx.moveTo(ox, oy - cell);
          ctx.lineTo(ox + cell, oy - halfH);
          ctx.lineTo(ox, oy);
          ctx.lineTo(ox - cell, oy - halfH);
          ctx.closePath();
          ctx.fill();
        }

        // Right face (+X'): hidden by the +X' neighbour in model coords.
        if (rightN === 0) {
          ctx.fillStyle = fillStyleFor(m, v, SHADE_RIGHT);
          ctx.beginPath();
          ctx.moveTo(ox + cell, oy + halfH);
          ctx.lineTo(ox, oy + cell);
          ctx.lineTo(ox, oy);
          ctx.lineTo(ox + cell, oy - halfH);
          ctx.closePath();
          ctx.fill();
        }

        // Left face (+Y'): hidden by the +Y' neighbour in model coords.
        if (leftN === 0) {
          ctx.fillStyle = fillStyleFor(m, v, SHADE_LEFT);
          ctx.beginPath();
          ctx.moveTo(ox - cell, oy + halfH);
          ctx.lineTo(ox, oy + cell);
          ctx.lineTo(ox, oy);
          ctx.lineTo(ox - cell, oy - halfH);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
}
