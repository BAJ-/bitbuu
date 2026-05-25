import type { Model } from './model';

export interface Camera {
  // Only 0 is implemented in this commit; #7 adds 1-3 via the coord-remap seam.
  yaw: 0 | 1 | 2 | 3;
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

// Future yaws (#7) will route coordinates through this seam so the draw code
// below stays unchanged. Yaw 0 is identity.
function remap(
  yaw: 0 | 1 | 2 | 3,
  x: number,
  y: number,
  z: number,
): readonly [number, number, number] {
  if (yaw !== 0) throw new RangeError(`yaw ${yaw} not implemented`);
  return [x, y, z];
}

export function render(m: Model, camera: Camera, ctx: CanvasRenderingContext2D): void {
  const cell = camera.zoom;
  const halfH = cell / 2;

  // Lex iteration x→y→z ascending is a valid painter's-algorithm order for
  // axis-aligned voxels under 2:1 isometric projection along (1,1,1): any two
  // voxels whose screen footprints overlap are ordered by this partial order.
  for (let z = 0; z < m.sz; z++) {
    for (let y = 0; y < m.sy; y++) {
      for (let x = 0; x < m.sx; x++) {
        const v = voxelAt(m, x, y, z);
        if (v === 0) continue;

        const xp1 = voxelAt(m, x + 1, y, z);
        const yp1 = voxelAt(m, x, y + 1, z);
        const zp1 = voxelAt(m, x, y, z + 1);

        // Buried voxels contribute nothing on screen even if we drew them; the
        // six-neighbour check lets us skip the per-face work entirely.
        if (
          xp1 !== 0 &&
          yp1 !== 0 &&
          zp1 !== 0 &&
          voxelAt(m, x - 1, y, z) !== 0 &&
          voxelAt(m, x, y - 1, z) !== 0 &&
          voxelAt(m, x, y, z - 1) !== 0
        ) {
          continue;
        }

        const [rx, ry, rz] = remap(camera.yaw, x, y, z);
        const ox = (rx - ry) * cell + camera.panX;
        const oy = (rx + ry) * halfH - rz * cell + camera.panY;

        // Top face (+z): hidden by the voxel directly above.
        if (zp1 === 0) {
          ctx.fillStyle = fillStyleFor(m, v, SHADE_TOP);
          ctx.beginPath();
          ctx.moveTo(ox, oy - cell);
          ctx.lineTo(ox + cell, oy - halfH);
          ctx.lineTo(ox, oy);
          ctx.lineTo(ox - cell, oy - halfH);
          ctx.closePath();
          ctx.fill();
        }

        // Right face (+x): hidden by the +x neighbour.
        if (xp1 === 0) {
          ctx.fillStyle = fillStyleFor(m, v, SHADE_RIGHT);
          ctx.beginPath();
          ctx.moveTo(ox + cell, oy + halfH);
          ctx.lineTo(ox, oy + cell);
          ctx.lineTo(ox, oy);
          ctx.lineTo(ox + cell, oy - halfH);
          ctx.closePath();
          ctx.fill();
        }

        // Left face (+y): hidden by the +y neighbour.
        if (yp1 === 0) {
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
