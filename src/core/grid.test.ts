import { describe, expect, it } from 'vitest';
import { createModel, setVoxel } from './model';
import { createProjector, type Camera } from './render';
import { forEachFloorCell, forEachGridSegment, gridBounds, type FloorCell } from './grid';

const camera: Camera = { yaw: 0, pitch: 1, zoom: 10, panX: 0, panY: 0 };

describe('gridBounds', () => {
  it('frames the centre cell as a 3x3x3 box when the model is empty', () => {
    const m = createModel(32, 32, 32);
    expect(gridBounds(m)).toEqual({
      minX: 15,
      minY: 15,
      minZ: 15,
      maxX: 18,
      maxY: 18,
      maxZ: 18,
    });
  });

  it('pads the occupied bbox by one cell on every axis', () => {
    const m = createModel(32, 32, 32);
    setVoxel(m, 5, 6, 7, 1);
    expect(gridBounds(m)).toEqual({
      minX: 4,
      minY: 5,
      minZ: 6,
      maxX: 7,
      maxY: 8,
      maxZ: 9,
    });
  });

  it('clamps the padded box to the model bounds', () => {
    const m = createModel(8, 8, 8);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 7, 7, 7, 1);
    expect(gridBounds(m)).toEqual({
      minX: 0,
      minY: 0,
      minZ: 0,
      maxX: 8,
      maxY: 8,
      maxZ: 8,
    });
  });
});

describe('forEachGridSegment', () => {
  it('emits floor gridlines plus the eight non-floor box edges', () => {
    const m = createModel(32, 32, 32);
    const b = gridBounds(m);
    let count = 0;
    forEachGridSegment(m, camera, () => {
      count++;
    });
    const floorLines = b.maxX - b.minX + 1 + (b.maxY - b.minY + 1);
    expect(count).toBe(floorLines + 8);
  });

  it('produces finite screen coordinates', () => {
    const m = createModel(32, 32, 32);
    setVoxel(m, 16, 16, 16, 1);
    forEachGridSegment(m, camera, (s) => {
      expect(Number.isFinite(s.x1)).toBe(true);
      expect(Number.isFinite(s.y1)).toBe(true);
      expect(Number.isFinite(s.x2)).toBe(true);
      expect(Number.isFinite(s.y2)).toBe(true);
    });
  });
});

describe('forEachFloorCell', () => {
  it('emits one cell per floor tile at the box bottom plane', () => {
    const m = createModel(32, 32, 32);
    const b = gridBounds(m);
    const cells: FloorCell[] = [];
    forEachFloorCell(m, camera, (c) => {
      cells.push({ ...c });
    });
    expect(cells).toHaveLength((b.maxX - b.minX) * (b.maxY - b.minY));
    for (const c of cells) expect(c.z).toBe(b.minZ);
    expect(cells.some((c) => c.gx === 15 && c.gy === 15)).toBe(true);
    expect(cells.some((c) => c.gx === 17 && c.gy === 17)).toBe(true);
  });

  it('projects cell corners identically to the shared projector', () => {
    const m = createModel(32, 32, 32);
    setVoxel(m, 16, 16, 16, 1);
    const p = createProjector(m, camera);
    forEachFloorCell(m, camera, (c) => {
      p.project(c.gx, c.gy, c.z);
      expect(c.x0).toBeCloseTo(p.ox, 12);
      expect(c.y0).toBeCloseTo(p.oy, 12);
      p.project(c.gx + 1, c.gy + 1, c.z);
      expect(c.x2).toBeCloseTo(p.ox, 12);
      expect(c.y2).toBeCloseTo(p.oy, 12);
    });
  });
});
