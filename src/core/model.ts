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
// Slots 1-3 are neutrals (dark, mid, light); slots 4-16 are pastel hues
// stepped around the colour wheel from red to pink.
const DEFAULT_PALETTE_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [0x2f, 0x2a, 0x36],
  [0x8d, 0x8a, 0x93],
  [0xf4, 0xec, 0xdc],
  [0xf0, 0xa8, 0xa8],
  [0xf3, 0xc0, 0x96],
  [0xec, 0xdb, 0x96],
  [0xc8, 0xdc, 0x96],
  [0xa4, 0xd7, 0xa4],
  [0x9c, 0xd9, 0xbb],
  [0x98, 0xdc, 0xd2],
  [0x98, 0xce, 0xe0],
  [0xa0, 0xc0, 0xe8],
  [0xb0, 0xb2, 0xeb],
  [0xc2, 0xac, 0xdd],
  [0xdc, 0xae, 0xdc],
  [0xf0, 0xae, 0xca],
];

export const DEFAULT_PALETTE: Uint8Array = (() => {
  const p = new Uint8Array(PALETTE_BYTES);
  for (let i = 0; i < 16; i++) {
    const c = DEFAULT_PALETTE_RGB[i]!;
    const o = (i + 1) * 4;
    p[o] = c[0];
    p[o + 1] = c[1];
    p[o + 2] = c[2];
    p[o + 3] = 0xff;
  }
  return p;
})();
