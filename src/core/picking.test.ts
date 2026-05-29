import { describe, expect, it } from 'vitest';
import { createModel } from './model';
import { decodeFaceId, encodeFaceId, faceIdFor, MAX_PICKABLE_VOXELS } from './picking';
import {
  FACE_BACK_LEFT,
  FACE_BACK_RIGHT,
  FACE_BOTTOM,
  FACE_KIND_COUNT,
  FACE_LEFT,
  FACE_RIGHT,
  FACE_TOP,
  faceNormal,
  type FaceKind,
} from './render';

describe('encodeFaceId / decodeFaceId', () => {
  it('round-trips through RGB encoding for every voxel and face in a small model', () => {
    const m = createModel(3, 4, 5);
    const kinds = [
      FACE_TOP,
      FACE_BOTTOM,
      FACE_RIGHT,
      FACE_BACK_LEFT,
      FACE_LEFT,
      FACE_BACK_RIGHT,
    ] as const;
    for (let z = 0; z < m.sz; z++) {
      for (let y = 0; y < m.sy; y++) {
        for (let x = 0; x < m.sx; x++) {
          for (const kind of kinds) {
            const id = faceIdFor(m, x, y, z, kind);
            const colour = encodeFaceId(id);
            const match = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(colour);
            expect(match).not.toBeNull();
            const r = Number(match![1]);
            const g = Number(match![2]);
            const b = Number(match![3]);
            const reconstructed = r | (g << 8) | (b << 16);
            const decoded = decodeFaceId(m, reconstructed);
            expect(decoded).toEqual({ x, y, z, kind });
          }
        }
      }
    }
  });

  it('rejects out-of-range ids', () => {
    expect(() => encodeFaceId(0)).toThrow();
    expect(() => encodeFaceId(-1)).toThrow();
    expect(() => encodeFaceId(0x1000000)).toThrow();
    expect(() => encodeFaceId(1.5)).toThrow();
  });

  it('returns null when decoding 0 (background)', () => {
    const m = createModel(2, 2, 2);
    expect(decodeFaceId(m, 0)).toBeNull();
  });

  it('returns null when decoding ids past the model', () => {
    const m = createModel(2, 2, 2);
    expect(decodeFaceId(m, 100)).toBeNull();
  });

  it('exposes a voxel capacity that matches the 24-bit RGB encoding', () => {
    expect(MAX_PICKABLE_VOXELS).toBe(Math.floor(0xffffff / FACE_KIND_COUNT));
    expect(encodeFaceId(MAX_PICKABLE_VOXELS * FACE_KIND_COUNT)).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  });
});

describe('faceNormal', () => {
  it('returns (0,0,+1) for the top face at every yaw', () => {
    for (const yaw of [0, 1, 2, 3] as const) {
      expect(faceNormal(yaw, FACE_TOP)).toEqual([0, 0, 1]);
    }
  });

  it('returns horizontal normals for side faces that match the yaw rotation', () => {
    expect(faceNormal(0, FACE_RIGHT)).toEqual([1, 0, 0]);
    expect(faceNormal(0, FACE_LEFT)).toEqual([0, 1, 0]);
    expect(faceNormal(2, FACE_RIGHT)).toEqual([-1, 0, 0]);
    expect(faceNormal(2, FACE_LEFT)).toEqual([0, -1, 0]);
  });

  it('returns unit-length normals along a single axis for every yaw and side face', () => {
    for (const yaw of [0, 1, 2, 3] as const) {
      for (const kind of [FACE_RIGHT, FACE_LEFT, FACE_BACK_RIGHT, FACE_BACK_LEFT] as FaceKind[]) {
        const [nx, ny, nz] = faceNormal(yaw, kind);
        expect(nz).toBe(0);
        expect(Math.abs(nx) + Math.abs(ny)).toBe(1);
      }
    }
  });

  it('returns (0,0,-1) for the bottom face at every yaw', () => {
    for (const yaw of [0, 1, 2, 3] as const) {
      expect(faceNormal(yaw, FACE_BOTTOM)).toEqual([0, 0, -1]);
    }
  });

  it('returns back-face normals opposite to their front-face counterparts', () => {
    for (const yaw of [0, 1, 2, 3] as const) {
      const r = faceNormal(yaw, FACE_RIGHT);
      const br = faceNormal(yaw, FACE_BACK_LEFT);
      expect(br).toEqual([-r[0], -r[1], 0]);
      const l = faceNormal(yaw, FACE_LEFT);
      const bl = faceNormal(yaw, FACE_BACK_RIGHT);
      expect(bl).toEqual([-l[0], -l[1], 0]);
    }
  });
});
