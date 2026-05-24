export const PALETTE_SLOTS = 256;
export const PALETTE_BYTES = PALETTE_SLOTS * 4;

export interface Model {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly voxels: Uint8Array;
  readonly palette: Uint8Array;
}

export function createModel(sx: number, sy: number, sz: number): Model {
  if (!Number.isInteger(sx) || !Number.isInteger(sy) || !Number.isInteger(sz)) {
    throw new RangeError('dimensions must be integers');
  }
  if (sx <= 0 || sy <= 0 || sz <= 0) {
    throw new RangeError('dimensions must be positive');
  }
  const voxels = new Uint8Array(sx * sy * sz);
  const palette = new Uint8Array(PALETTE_BYTES);
  palette.set(DEFAULT_PALETTE);
  return { sx, sy, sz, voxels, palette };
}

function indexOf(m: Model, x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0 || x >= m.sx || y >= m.sy || z >= m.sz) {
    throw new RangeError(`out of bounds: (${x},${y},${z})`);
  }
  return x + y * m.sx + z * m.sx * m.sy;
}

export function getVoxel(m: Model, x: number, y: number, z: number): number {
  return m.voxels[indexOf(m, x, y, z)]!;
}

export function setVoxel(m: Model, x: number, y: number, z: number, v: number): void {
  if (!Number.isInteger(v) || v < 0 || v > 255) {
    throw new RangeError(`voxel value out of range: ${v}`);
  }
  m.voxels[indexOf(m, x, y, z)] = v;
}

// Voxel byte 0 is the empty sentinel; the palette's slot 0 is therefore unused.
// The 16 default colours live in slots 1-16 (DawnBringer 16).
const DB16_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [0x14, 0x0c, 0x1c],
  [0x44, 0x24, 0x34],
  [0x30, 0x34, 0x6d],
  [0x4e, 0x4a, 0x4e],
  [0x85, 0x4c, 0x30],
  [0x34, 0x65, 0x24],
  [0xd0, 0x46, 0x48],
  [0x75, 0x71, 0x61],
  [0x59, 0x7d, 0xce],
  [0xd2, 0x7d, 0x2c],
  [0x85, 0x95, 0xa1],
  [0x6d, 0xaa, 0x2c],
  [0xd2, 0xaa, 0x99],
  [0x6d, 0xc2, 0xca],
  [0xda, 0xd4, 0x5e],
  [0xde, 0xee, 0xd6],
];

export const DEFAULT_PALETTE: Uint8Array = (() => {
  const p = new Uint8Array(PALETTE_BYTES);
  for (let i = 0; i < 16; i++) {
    const c = DB16_RGB[i]!;
    const o = (i + 1) * 4;
    p[o] = c[0];
    p[o + 1] = c[1];
    p[o + 2] = c[2];
    p[o + 3] = 0xff;
  }
  return p;
})();
