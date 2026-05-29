import { describe, expect, it } from 'vitest';
import { createModel, setVoxel } from './model';
import { forEachVisibleFace, render, type Camera, type Yaw } from './render';

interface Fill {
  style: string;
  points: Array<readonly [number, number]>;
}

function mockCtx(): { ctx: CanvasRenderingContext2D; fills: Fill[] } {
  const fills: Fill[] = [];
  let current: Array<readonly [number, number]> = [];
  let fillStyle: string = '';
  const ctx = {
    set fillStyle(v: string) {
      fillStyle = v;
    },
    get fillStyle(): string {
      return fillStyle;
    },
    beginPath() {
      current = [];
    },
    moveTo(x: number, y: number) {
      current.push([x, y]);
    },
    lineTo(x: number, y: number) {
      current.push([x, y]);
    },
    closePath() {},
    fill() {
      fills.push({ style: fillStyle, points: current.slice() });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
}

const camera: Camera = { yaw: 0, pitch: 1, zoom: 10, panX: 0, panY: 0 };

describe('render', () => {
  it('draws nothing for an empty model', () => {
    const m = createModel(4, 4, 4);
    const { ctx, fills } = mockCtx();
    render(m, camera, ctx);
    expect(fills).toHaveLength(0);
  });

  it('draws three faces for a single isolated voxel', () => {
    const m = createModel(1, 1, 1);
    setVoxel(m, 0, 0, 0, 1);
    const { ctx, fills } = mockCtx();
    render(m, camera, ctx);
    expect(fills).toHaveLength(3);
    const styles = new Set(fills.map((f) => f.style));
    expect(styles.size).toBe(3);
  });

  it('culls every face on a fully buried voxel', () => {
    const m = createModel(3, 3, 3);
    for (let z = 0; z < 3; z++)
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) setVoxel(m, x, y, z, 1);
    const { ctx, fills } = mockCtx();
    render(m, camera, ctx);
    // 3·3 visible faces on each of the 3 camera-facing sides.
    expect(fills).toHaveLength(27);
  });

  it('skips occluded faces between two stacked voxels', () => {
    const m = createModel(1, 1, 2);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 0, 0, 1, 1);
    const { ctx, fills } = mockCtx();
    render(m, camera, ctx);
    // Lower voxel: 2 faces (top hidden). Upper voxel: 3 faces.
    expect(fills).toHaveLength(5);
  });

  it('iterates back-to-front so closer voxels are visited last', () => {
    const m = createModel(2, 2, 2);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 1, 1, 1, 2);
    const order: number[] = [];
    forEachVisibleFace(m, camera, (f) => {
      order.push(f.v);
    });
    expect(order).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it('produces the same number of face fills under all four yaws', () => {
    const m = createModel(3, 4, 2);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 1, 0, 0, 1);
    setVoxel(m, 1, 1, 0, 1);
    setVoxel(m, 2, 2, 1, 1);
    setVoxel(m, 0, 3, 0, 1);
    const counts = ([0, 1, 2, 3] as const).map((yaw: Yaw) => {
      const { ctx, fills } = mockCtx();
      render(m, { yaw, pitch: 1, zoom: 10, panX: 0, panY: 0 }, ctx);
      return fills.length;
    });
    expect(new Set(counts).size).toBe(1);
  });

  it('pivots a 1x1x1 voxel symmetrically around the pan origin for every (yaw, pitch)', () => {
    const m = createModel(1, 1, 1);
    setVoxel(m, 0, 0, 0, 1);
    for (const yaw of [0, 1, 2, 3] as const) {
      for (let pitch = 0; pitch < 8; pitch++) {
        const { ctx, fills } = mockCtx();
        render(m, { yaw, pitch, zoom: 10, panX: 0, panY: 0 }, ctx);
        if (fills.length === 0) continue;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const f of fills)
          for (const [x, y] of f.points) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        expect(Math.abs((minX + maxX) / 2)).toBeLessThan(1e-9);
        expect(Math.abs((minY + maxY) / 2)).toBeLessThan(1e-9);
      }
    }
  });

  it('pivots an asymmetric solid box symmetrically (catches yaw axis-swap bugs sx!==sy)', () => {
    const m = createModel(3, 5, 2);
    for (let z = 0; z < m.sz; z++)
      for (let y = 0; y < m.sy; y++) for (let x = 0; x < m.sx; x++) setVoxel(m, x, y, z, 1);
    for (const yaw of [0, 1, 2, 3] as const) {
      for (let pitch = 0; pitch < 8; pitch++) {
        const { ctx, fills } = mockCtx();
        render(m, { yaw, pitch, zoom: 10, panX: 0, panY: 0 }, ctx);
        if (fills.length === 0) continue;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const f of fills)
          for (const [x, y] of f.points) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        expect(Math.abs((minX + maxX) / 2)).toBeLessThan(1e-9);
        expect(Math.abs((minY + maxY) / 2)).toBeLessThan(1e-9);
      }
    }
  });

  it('pivots around the occupied bbox, not the world bbox', () => {
    const m = createModel(32, 32, 32);
    setVoxel(m, 0, 0, 0, 1);
    for (const yaw of [0, 1, 2, 3] as const) {
      for (let pitch = 0; pitch < 8; pitch++) {
        const { ctx, fills } = mockCtx();
        render(m, { yaw, pitch, zoom: 10, panX: 0, panY: 0 }, ctx);
        if (fills.length === 0) continue;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const f of fills)
          for (const [x, y] of f.points) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        expect(Math.abs((minX + maxX) / 2)).toBeLessThan(1e-9);
        expect(Math.abs((minY + maxY) / 2)).toBeLessThan(1e-9);
      }
    }
  });

  it('emits only top faces at pitch 2 (no cardinal-pitch side slivers)', () => {
    const m = createModel(2, 2, 2);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 1, 1, 1, 1);
    const { ctx, fills } = mockCtx();
    render(m, { yaw: 0, pitch: 2, zoom: 10, panX: 0, panY: 0 }, ctx);
    expect(fills).toHaveLength(2);
  });

  it('emits only bottom faces at pitch 6', () => {
    const m = createModel(2, 2, 2);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 1, 1, 1, 1);
    const { ctx, fills } = mockCtx();
    render(m, { yaw: 0, pitch: 6, zoom: 10, panX: 0, panY: 0 }, ctx);
    expect(fills).toHaveLength(2);
  });
});
