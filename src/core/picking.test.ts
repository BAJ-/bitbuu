import { describe, expect, it } from 'vitest';
import { createModel } from './model';
import { decodeFaceId, encodeFaceId, faceIdFor } from './picking';
import { FACE_LEFT, FACE_RIGHT, FACE_TOP, faceNormal, type FaceKind } from './render';

describe('encodeFaceId / decodeFaceId', () => {
  it('round-trips through RGB encoding for every voxel and face in a small model', () => {
    const m = createModel(3, 4, 5);
    for (let z = 0; z < m.sz; z++) {
      for (let y = 0; y < m.sy; y++) {
        for (let x = 0; x < m.sx; x++) {
          for (const kind of [FACE_TOP, FACE_RIGHT, FACE_LEFT] as const) {
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
    // Maximum valid id for a 2x2x2 model: 8 voxels * 3 faces = 24.
    expect(decodeFaceId(m, 100)).toBeNull();
  });
});

describe('faceNormal', () => {
  it('returns (0,0,+1) for the top face at every yaw', () => {
    for (const yaw of [0, 1, 2, 3] as const) {
      expect(faceNormal(yaw, FACE_TOP)).toEqual([0, 0, 1]);
    }
  });

  it('returns horizontal normals for side faces that match the yaw rotation', () => {
    // At yaw 0, right face is +x and left face is +y.
    expect(faceNormal(0, FACE_RIGHT)).toEqual([1, 0, 0]);
    expect(faceNormal(0, FACE_LEFT)).toEqual([0, 1, 0]);
    // At yaw 2 (180°), right and left are mirrored.
    expect(faceNormal(2, FACE_RIGHT)).toEqual([-1, 0, 0]);
    expect(faceNormal(2, FACE_LEFT)).toEqual([0, -1, 0]);
  });

  it('returns unit-length normals along a single axis for every yaw and side face', () => {
    for (const yaw of [0, 1, 2, 3] as const) {
      for (const kind of [FACE_RIGHT, FACE_LEFT] as FaceKind[]) {
        const [nx, ny, nz] = faceNormal(yaw, kind);
        expect(nz).toBe(0);
        expect(Math.abs(nx) + Math.abs(ny)).toBe(1);
      }
    }
  });
});
