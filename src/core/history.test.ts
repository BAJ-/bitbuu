import { describe, expect, it } from 'vitest';
import { createHistory } from './history';

function snap(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

describe('createHistory', () => {
  it('reports canUndo/canRedo as false when empty', () => {
    const h = createHistory();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undo(snap(1))).toBeNull();
    expect(h.redo(snap(1))).toBeNull();
  });

  it('undo returns the previously pushed state and stashes current onto redo', () => {
    const h = createHistory();
    h.push(snap(0));
    h.push(snap(1));
    const current = snap(2);
    const prev = h.undo(current);
    expect(prev).toEqual(snap(1));
    expect(h.canRedo).toBe(true);
    const after = h.redo(snap(1));
    expect(after).toEqual(snap(2));
  });

  it('snapshots are decoupled from the caller buffer (copy on push)', () => {
    const h = createHistory();
    const live = snap(1, 2, 3);
    h.push(live);
    live[0] = 99;
    const prev = h.undo(snap(0, 0, 0));
    expect(prev).toEqual(snap(1, 2, 3));
  });

  it('a new push clears the redo stack', () => {
    const h = createHistory();
    h.push(snap(0));
    h.undo(snap(1));
    expect(h.canRedo).toBe(true);
    h.push(snap(2));
    expect(h.canRedo).toBe(false);
    expect(h.redo(snap(2))).toBeNull();
  });
});
