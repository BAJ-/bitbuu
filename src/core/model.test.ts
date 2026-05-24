import { describe, expect, it } from 'vitest';
import { createModel, DEFAULT_PALETTE, getVoxel, PALETTE_BYTES, setVoxel } from './model';

describe('createModel', () => {
  it('allocates dense voxel buffer of sx*sy*sz bytes, zero-initialised', () => {
    const m = createModel(4, 5, 6);
    expect(m.voxels.length).toBe(120);
    expect(m.voxels.every((v) => v === 0)).toBe(true);
  });

  it('allocates a 256-slot RGBA palette and copies the default', () => {
    const m = createModel(1, 1, 1);
    expect(m.palette.length).toBe(PALETTE_BYTES);
    expect(m.palette).toStrictEqual(DEFAULT_PALETTE);
  });

  it('gives each model an independent palette buffer', () => {
    const a = createModel(1, 1, 1);
    const b = createModel(1, 1, 1);
    a.palette[4] = 0x42;
    expect(b.palette[4]).not.toBe(0x42);
  });

  it.each([
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
    [-1, 1, 1],
    [1.5, 1, 1],
  ])('rejects invalid dimensions (%i, %i, %i)', (x, y, z) => {
    expect(() => createModel(x, y, z)).toThrow(RangeError);
  });
});

describe('voxel access', () => {
  it('round-trips set then get', () => {
    const m = createModel(3, 3, 3);
    setVoxel(m, 1, 2, 0, 7);
    expect(getVoxel(m, 1, 2, 0)).toBe(7);
  });

  it('uses x-fastest indexing (x + y*sx + z*sx*sy)', () => {
    const m = createModel(2, 3, 4);
    setVoxel(m, 1, 2, 3, 9);
    expect(m.voxels[1 + 2 * 2 + 3 * 2 * 3]).toBe(9);
  });

  it.each([
    [-1, 0, 0],
    [0, -1, 0],
    [0, 0, -1],
    [2, 0, 0],
    [0, 3, 0],
    [0, 0, 4],
  ])('rejects out-of-bounds coordinates (%i, %i, %i)', (x, y, z) => {
    const m = createModel(2, 3, 4);
    expect(() => getVoxel(m, x, y, z)).toThrow(RangeError);
    expect(() => setVoxel(m, x, y, z, 1)).toThrow(RangeError);
  });

  it.each([-1, 256, 1.5])('rejects invalid voxel values (%i)', (v) => {
    const m = createModel(1, 1, 1);
    expect(() => setVoxel(m, 0, 0, 0, v)).toThrow(RangeError);
  });
});

describe('DEFAULT_PALETTE', () => {
  it('leaves slot 0 zeroed (the empty sentinel is in the voxel byte, not the palette)', () => {
    for (let i = 0; i < 4; i++) {
      expect(DEFAULT_PALETTE[i]).toBe(0);
    }
  });

  it('marks slots 1-16 as fully opaque', () => {
    for (let i = 1; i <= 16; i++) {
      expect(DEFAULT_PALETTE[i * 4 + 3]).toBe(0xff);
    }
  });

  it('leaves slots 17-255 zeroed', () => {
    for (let i = 17 * 4; i < PALETTE_BYTES; i++) {
      expect(DEFAULT_PALETTE[i]).toBe(0);
    }
  });
});
