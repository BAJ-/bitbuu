import type { Model } from './model';

export type Yaw = 0 | 1 | 2 | 3;
export type Pitch = number;

export const PITCH_COUNT = 8;
const PITCH_STEP_RAD = (2 * Math.PI) / PITCH_COUNT;
// Index 1 = 45° elevation (true iso view). Pitch wraps modulo PITCH_COUNT.
export const PITCH_DEFAULT = 1;

// Ortho projection at azimuth 45°, elevation θ, after the per-yaw rotate(x, y):
//   screen_x = (px - py) · S / √2
//   screen_y = (px + py) · sinθ · S / √2  -  pz · cosθ · S
// With S = cell · √2 this becomes ox = (dx - dy) · cell and
// oy = (dx + dy) · vXY - (z - zAnchor) · vZ, where vXY = cell · sinθ and
// vZ = cell · √2 · cosθ. Signed; the signs carry the camera around the sphere.
const Z_PROJ_SCALE = Math.SQRT2;

export interface Camera {
  yaw: Yaw;
  pitch: Pitch;
  zoom: number;
  panX: number;
  panY: number;
}

const SHADE_TOP = 1.0;
const SHADE_BOTTOM = 0.5;
const SHADE_LEFT = 0.78;
const SHADE_RIGHT = 0.58;
const SHADE_BACK_LEFT = 0.66;
const SHADE_BACK_RIGHT = 0.48;

function voxelAt(m: Model, x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0 || x >= m.sx || y >= m.sy || z >= m.sz) return 0;
  return m.voxels[x + y * m.sx + z * m.sx * m.sy]!;
}

// Continuous bbox of occupied cells (max exclusive). Falls back to the world
// bbox when empty so rotation still has a pivot.
function occupiedBounds(m: Model): {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
} {
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
  if (!any) return { minX: 0, minY: 0, minZ: 0, maxX: sx, maxY: sy, maxZ: sz };
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function fillStyleFor(m: Model, v: number, shade: number): string {
  const o = v * 4;
  const r = Math.round(m.palette[o]! * shade);
  const g = Math.round(m.palette[o + 1]! * shade);
  const b = Math.round(m.palette[o + 2]! * shade);
  return `rgb(${r},${g},${b})`;
}

// `rotate` maps model (x, y) into the camera-aligned frame (camera at azimuth
// 45° NE). `right`/`left` are model-space neighbour offsets along that frame's
// +x and +y. `stepX`/`stepY` are the loop directions that visit voxels
// back-to-front when cosθ > 0; both are negated when cosθ < 0.
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

// Face axes in the camera-aligned (post-yaw) frame:
//   +x_rot = RIGHT, -x_rot = BACK_LEFT, +y_rot = LEFT, -y_rot = BACK_RIGHT.
export const FACE_TOP = 0;
export const FACE_BOTTOM = 1;
export const FACE_RIGHT = 2;
export const FACE_BACK_LEFT = 3;
export const FACE_LEFT = 4;
export const FACE_BACK_RIGHT = 5;
export type FaceKind = 0 | 1 | 2 | 3 | 4 | 5;
export const FACE_KIND_COUNT = 6;

export interface VisibleFace {
  v: number;
  x: number;
  y: number;
  z: number;
  // Screen position of the voxel's (0,0,0) corner.
  ox: number;
  oy: number;
  cell: number;
  // Signed screen-Y projections of one model unit along the camera-aligned
  // XY axes and along Z. See Z_PROJ_SCALE for the derivation.
  vXY: number;
  vZ: number;
  kind: FaceKind;
}

export function faceNormal(yaw: Yaw, kind: FaceKind): readonly [number, number, number] {
  if (kind === FACE_TOP) return [0, 0, 1];
  if (kind === FACE_BOTTOM) return [0, 0, -1];
  const cfg = YAWS[yaw];
  if (kind === FACE_RIGHT) return [cfg.right[0], cfg.right[1], 0];
  if (kind === FACE_LEFT) return [cfg.left[0], cfg.left[1], 0];
  if (kind === FACE_BACK_LEFT) return [-cfg.right[0], -cfg.right[1], 0];
  return [-cfg.left[0], -cfg.left[1], 0];
}

// The VisibleFace passed to `cb` is a mutable scratch object reused across
// every face. Callers must not retain the reference.
export function forEachVisibleFace(m: Model, camera: Camera, cb: (f: VisibleFace) => void): void {
  const cfg = YAWS[camera.yaw];
  const cell = camera.zoom;
  const pIdx = (((camera.pitch % PITCH_COUNT) + PITCH_COUNT) % PITCH_COUNT) | 0;
  const theta = pIdx * PITCH_STEP_RAD;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const vXY = cell * sinT;
  const vZ = cell * Z_PROJ_SCALE * cosT;

  // Visibility and painter's order use sgn-from-index, not Math.sin/cos:
  // Math.cos(π/2) returns ~6e-17, which would leak degenerate sliver faces
  // into the output and into picking at the cardinal pitches.
  const sgnCos = pIdx === 0 || pIdx === 1 || pIdx === 7 ? 1 : pIdx >= 3 && pIdx <= 5 ? -1 : 0;
  const sgnSin = pIdx >= 1 && pIdx <= 3 ? 1 : pIdx >= 5 && pIdx <= 7 ? -1 : 0;

  // Pivot around the occupied bbox centre so an off-centre shape doesn't
  // orbit when rotated. cfg.rotate is unsuitable here — its -1 offsets map
  // voxel INDICES, not continuous coordinates — so the rotation is inlined.
  const bb = occupiedBounds(m);
  const ocx = (bb.minX + bb.maxX) / 2;
  const ocy = (bb.minY + bb.maxY) / 2;
  const ocz = (bb.minZ + bb.maxZ) / 2;
  let cxRot: number;
  let cyRot: number;
  if (camera.yaw === 0) {
    cxRot = ocx;
    cyRot = ocy;
  } else if (camera.yaw === 1) {
    cxRot = m.sy - ocy;
    cyRot = ocx;
  } else if (camera.yaw === 2) {
    cxRot = m.sx - ocx;
    cyRot = m.sy - ocy;
  } else {
    cxRot = ocy;
    cyRot = m.sx - ocx;
  }
  const zAnchor = ocz;

  const xyDir = sgnCos >= 0 ? 1 : -1;
  const zDir = sgnSin >= 0 ? 1 : -1;
  const stepX = (cfg.stepX * xyDir) as 1 | -1;
  const stepY = (cfg.stepY * xyDir) as 1 | -1;
  const startX = stepX > 0 ? 0 : m.sx - 1;
  const endX = stepX > 0 ? m.sx : -1;
  const startY = stepY > 0 ? 0 : m.sy - 1;
  const endY = stepY > 0 ? m.sy : -1;
  const startZ = zDir > 0 ? 0 : m.sz - 1;
  const endZ = zDir > 0 ? m.sz : -1;

  const [rdx, rdy] = cfg.right;
  const [ldx, ldy] = cfg.left;

  const showTop = sgnSin > 0;
  const showBottom = sgnSin < 0;
  const showRight = sgnCos > 0;
  const showLeft = sgnCos > 0;
  const showBackLeft = sgnCos < 0;
  const showBackRight = sgnCos < 0;

  const face: VisibleFace = {
    v: 0,
    x: 0,
    y: 0,
    z: 0,
    ox: 0,
    oy: 0,
    cell,
    vXY,
    vZ,
    kind: FACE_TOP,
  };

  for (let z = startZ; z !== endZ; z += zDir) {
    for (let y = startY; y !== endY; y += stepY) {
      for (let x = startX; x !== endX; x += stepX) {
        const v = voxelAt(m, x, y, z);
        if (v === 0) continue;

        const rightN = voxelAt(m, x + rdx, y + rdy, z);
        const leftN = voxelAt(m, x + ldx, y + ldy, z);
        const backLeftN = voxelAt(m, x - rdx, y - rdy, z);
        const backRightN = voxelAt(m, x - ldx, y - ldy, z);
        const topN = voxelAt(m, x, y, z + 1);
        const botN = voxelAt(m, x, y, z - 1);

        if (
          rightN !== 0 &&
          leftN !== 0 &&
          backLeftN !== 0 &&
          backRightN !== 0 &&
          topN !== 0 &&
          botN !== 0
        ) {
          continue;
        }

        const [rx, ry] = cfg.rotate(x, y, m.sx, m.sy);
        const dx = rx - cxRot;
        const dy = ry - cyRot;
        const ox = (dx - dy) * cell + camera.panX;
        const oy = (dx + dy) * vXY - (z - zAnchor) * vZ + camera.panY;

        face.v = v;
        face.x = x;
        face.y = y;
        face.z = z;
        face.ox = ox;
        face.oy = oy;

        if (showTop && topN === 0) {
          face.kind = FACE_TOP;
          cb(face);
        }
        if (showBottom && botN === 0) {
          face.kind = FACE_BOTTOM;
          cb(face);
        }
        if (showRight && rightN === 0) {
          face.kind = FACE_RIGHT;
          cb(face);
        }
        if (showLeft && leftN === 0) {
          face.kind = FACE_LEFT;
          cb(face);
        }
        if (showBackLeft && backLeftN === 0) {
          face.kind = FACE_BACK_LEFT;
          cb(face);
        }
        if (showBackRight && backRightN === 0) {
          face.kind = FACE_BACK_RIGHT;
          cb(face);
        }
      }
    }
  }
}

// Each case lists the four model-space corners of the face (in winding order),
// then projects them as offsets from (ox, oy) using signed vXY/vZ.
export function drawFacePath(ctx: CanvasRenderingContext2D, f: VisibleFace): void {
  const { ox, oy, cell, vXY, vZ, kind } = f;
  ctx.beginPath();
  switch (kind) {
    case FACE_TOP:
      // (0,0,1) (1,0,1) (1,1,1) (0,1,1)
      ctx.moveTo(ox, oy - vZ);
      ctx.lineTo(ox + cell, oy + vXY - vZ);
      ctx.lineTo(ox, oy + 2 * vXY - vZ);
      ctx.lineTo(ox - cell, oy + vXY - vZ);
      break;
    case FACE_BOTTOM:
      // (0,0,0) (1,0,0) (1,1,0) (0,1,0)
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + cell, oy + vXY);
      ctx.lineTo(ox, oy + 2 * vXY);
      ctx.lineTo(ox - cell, oy + vXY);
      break;
    case FACE_RIGHT:
      // (1,0,0) (1,1,0) (1,1,1) (1,0,1)
      ctx.moveTo(ox + cell, oy + vXY);
      ctx.lineTo(ox, oy + 2 * vXY);
      ctx.lineTo(ox, oy + 2 * vXY - vZ);
      ctx.lineTo(ox + cell, oy + vXY - vZ);
      break;
    case FACE_BACK_LEFT:
      // (0,0,0) (0,1,0) (0,1,1) (0,0,1)
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox - cell, oy + vXY);
      ctx.lineTo(ox - cell, oy + vXY - vZ);
      ctx.lineTo(ox, oy - vZ);
      break;
    case FACE_LEFT:
      // (0,1,0) (1,1,0) (1,1,1) (0,1,1)
      ctx.moveTo(ox - cell, oy + vXY);
      ctx.lineTo(ox, oy + 2 * vXY);
      ctx.lineTo(ox, oy + 2 * vXY - vZ);
      ctx.lineTo(ox - cell, oy + vXY - vZ);
      break;
    case FACE_BACK_RIGHT:
      // (0,0,0) (1,0,0) (1,0,1) (0,0,1)
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + cell, oy + vXY);
      ctx.lineTo(ox + cell, oy + vXY - vZ);
      ctx.lineTo(ox, oy - vZ);
      break;
  }
  ctx.closePath();
  ctx.fill();
}

function shadeFor(kind: FaceKind): number {
  switch (kind) {
    case FACE_TOP:
      return SHADE_TOP;
    case FACE_BOTTOM:
      return SHADE_BOTTOM;
    case FACE_RIGHT:
      return SHADE_RIGHT;
    case FACE_LEFT:
      return SHADE_LEFT;
    case FACE_BACK_RIGHT:
      return SHADE_BACK_RIGHT;
    case FACE_BACK_LEFT:
      return SHADE_BACK_LEFT;
  }
}

export function render(m: Model, camera: Camera, ctx: CanvasRenderingContext2D): void {
  forEachVisibleFace(m, camera, (f) => {
    ctx.fillStyle = fillStyleFor(m, f.v, shadeFor(f.kind));
    drawFacePath(ctx, f);
  });
}
