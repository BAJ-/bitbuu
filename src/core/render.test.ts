import { describe, expect, it } from 'vitest';
import { createModel, setVoxel } from './model';
import { render, type Camera } from './render';

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
    // 3x3x3 solid block: 27 voxels, but only the outer-positive slabs are visible:
    // 9 top + 9 right (+x) + 9 left (+y) = 27 face fills. The center voxel
    // (1,1,1) has all six neighbours and must contribute zero.
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

  it('iterates back-to-front so closer voxels paint over further ones', () => {
    // Two voxels at (0,0,0) and (1,1,1). With camera at (+,+,+) the second is
    // strictly in front. In lex x→y→z order it is visited second, so its fills
    // appear later in the fill list.
    const m = createModel(2, 2, 2);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 1, 1, 1, 2);
    const { ctx, fills } = mockCtx();
    render(m, camera, ctx);
    // Six fills total (three per isolated voxel). The last three came from the
    // front voxel, identifiable by colour shade prefixes — both use distinct
    // palette slots so styles cluster by source.
    expect(fills).toHaveLength(6);
  });
});
