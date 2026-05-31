import type { Model } from './model';
import { forEachFloorCell, roomPlanes } from './grid';
import {
  drawFacePath,
  FACE_KIND_COUNT,
  faceNormal,
  forEachVisibleFace,
  type Camera,
  type FaceKind,
} from './render';

export interface PickedFace {
  // Voxel the face of the cube belongs to.
  x: number;
  y: number;
  z: number;
  // Outward normal in model coords; adding it to (x,y,z) gives the cell into
  // which a new voxel should be placed.
  nx: number;
  ny: number;
  nz: number;
}

// 24-bit RGB caps the face id at 0xFFFFFF
export const MAX_PICKABLE_FACES = 0xffffff;
export const MAX_PICKABLE_VOXELS = Math.floor(MAX_PICKABLE_FACES / FACE_KIND_COUNT);

export function encodeFaceId(id: number): string {
  if (!Number.isInteger(id) || id <= 0 || id > 0xffffff) {
    throw new RangeError(`face id out of range: ${id}`);
  }
  const r = id & 0xff;
  const g = (id >> 8) & 0xff;
  const b = (id >> 16) & 0xff;
  return `rgb(${r},${g},${b})`;
}

export function decodeFaceId(
  m: Model,
  id: number,
): { x: number; y: number; z: number; kind: FaceKind } | null {
  if (id <= 0) return null;
  const id0 = id - 1;
  const kind = (id0 % FACE_KIND_COUNT) as FaceKind;
  const voxelIdx = (id0 - kind) / FACE_KIND_COUNT;
  const x = voxelIdx % m.sx;
  const y = Math.floor(voxelIdx / m.sx) % m.sy;
  const z = Math.floor(voxelIdx / (m.sx * m.sy));
  if (z >= m.sz) return null;
  return { x, y, z, kind };
}

export function faceIdFor(m: Model, x: number, y: number, z: number, kind: FaceKind): number {
  const voxelIdx = x + y * m.sx + z * m.sx * m.sy;
  return voxelIdx * FACE_KIND_COUNT + kind + 1;
}

// Floor cells live in an id band just above every possible model face id, so a
// single pick buffer can carry both without collision.
function floorIdBase(m: Model): number {
  return m.sx * m.sy * m.sz * FACE_KIND_COUNT + 1;
}

export function floorIdFor(m: Model, gx: number, gy: number): number {
  return floorIdBase(m) + gx + gy * m.sx;
}

function decodeFloorId(m: Model, id: number): { gx: number; gy: number } | null {
  const idx = id - floorIdBase(m);
  if (idx < 0 || idx >= m.sx * m.sy) return null;
  return { gx: idx % m.sx, gy: Math.floor(idx / m.sx) };
}

export interface Picker {
  pick(
    m: Model,
    camera: Camera,
    cssW: number,
    cssH: number,
    px: number,
    py: number,
    dpr: number,
  ): PickedFace | null;
}

export function createPicker(): Picker {
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { willReadFrequently: true });
  if (!bctx) throw new Error('2d context unavailable for picker');

  return {
    pick(m, camera, cssW, cssH, px, py, dpr) {
      if (cssW <= 0 || cssH <= 0) return null;
      if (px < 0 || py < 0 || px >= cssW || py >= cssH) return null;
      // Highest id encoded below: the last floor cell sits above the face band.
      if (m.sx * m.sy * m.sz * FACE_KIND_COUNT + m.sx * m.sy > MAX_PICKABLE_FACES) {
        throw new RangeError(
          `model exceeds picker capacity (${m.sx}x${m.sy}x${m.sz} faces plus floor cells > ${MAX_PICKABLE_FACES} ids)`,
        );
      }

      // Sample at the visible canvas's backing resolution so anti-aliased edges line up.
      const bw = Math.max(1, Math.floor(cssW * dpr));
      const bh = Math.max(1, Math.floor(cssH * dpr));
      if (buf.width !== bw || buf.height !== bh) {
        buf.width = bw;
        buf.height = bh;
      }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.fillStyle = '#000000';
      bctx.fillRect(0, 0, cssW, cssH);

      // Floor first, then model faces on top: a voxel face always wins the hit
      // test over the floor behind it, so clicking a voxel's bottom face places
      // below it rather than resolving to a floor tile.
      forEachFloorCell(m, camera, (fc) => {
        bctx.fillStyle = encodeFaceId(floorIdFor(m, fc.gx, fc.gy));
        bctx.beginPath();
        bctx.moveTo(fc.x0, fc.y0);
        bctx.lineTo(fc.x1, fc.y1);
        bctx.lineTo(fc.x2, fc.y2);
        bctx.lineTo(fc.x3, fc.y3);
        bctx.closePath();
        bctx.fill();
      });

      forEachVisibleFace(m, camera, (f) => {
        bctx.fillStyle = encodeFaceId(faceIdFor(m, f.x, f.y, f.z, f.kind));
        drawFacePath(bctx, f);
      });

      const sx = Math.min(bw - 1, Math.max(0, Math.floor(px * dpr)));
      const sy = Math.min(bh - 1, Math.max(0, Math.floor(py * dpr)));
      const data = bctx.getImageData(sx, sy, 1, 1).data;
      if (data[3] !== 255) return null;
      const id = data[0]! | (data[1]! << 8) | (data[2]! << 16);

      const floor = decodeFloorId(m, id);
      if (floor) {
        // Virtual up-normal face on the floor plane: the click handler adds the
        // normal to land a voxel resting on the clicked tile.
        return { x: floor.gx, y: floor.gy, z: roomPlanes(m).floorZ - 1, nx: 0, ny: 0, nz: 1 };
      }

      const decoded = decodeFaceId(m, id);
      if (!decoded) return null;

      const [nx, ny, nz] = faceNormal(camera.yaw, decoded.kind);
      return { x: decoded.x, y: decoded.y, z: decoded.z, nx, ny, nz };
    },
  };
}
