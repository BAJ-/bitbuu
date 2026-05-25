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

const camera: Camera = { yaw: 0, zoom: 10, panX: 0, panY: 0 };

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
    // Three distinct shades (top brightest, left medium, right darkest).
    const styles = new Set(fills.map((f) => f.style));
    expect(styles.size).toBe(3);
  });

  it('culls every face on a fully buried voxel', () => {
    // Three visible sides (top, +x, +y) of 9 faces each = 27.
    const m = createModel(3, 3, 3);
    for (let z = 0; z < 3; z++)
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) setVoxel(m, x, y, z, 1);
    const { ctx, fills } = mockCtx();
    render(m, camera, ctx);
    expect(fills).toHaveLength(27);
  });

  it('skips occluded faces between two stacked voxels', () => {
    // Voxel A at z=0, B at z=1. A's top face is hidden by B. Each has 3 visible
    // faces normally; A loses its top → 2 faces. Total = 2 + 3 = 5.
    const m = createModel(1, 1, 2);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 0, 0, 1, 1);
    const { ctx, fills } = mockCtx();
    render(m, camera, ctx);
    expect(fills).toHaveLength(5);
  });

  it('iterates back-to-front so closer voxels are visited last', () => {
    // Camera at (+,+,+): voxel at (1,1,1) is strictly in front of (0,0,0).
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
    // Rotation around +z is a symmetry of the visible-face count: every yaw
    // should draw exactly the same surface area, just in different positions.
    const m = createModel(3, 4, 2);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 1, 0, 0, 1);
    setVoxel(m, 1, 1, 0, 1);
    setVoxel(m, 2, 2, 1, 1);
    setVoxel(m, 0, 3, 0, 1);
    const counts = ([0, 1, 2, 3] as const).map((yaw: Yaw) => {
      const { ctx, fills } = mockCtx();
      render(m, { yaw, zoom: 10, panX: 0, panY: 0 }, ctx);
      return fills.length;
    });
    expect(new Set(counts).size).toBe(1);
  });
});
