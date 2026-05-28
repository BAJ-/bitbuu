import { describe, expect, it } from 'vitest';
import { createModel, setVoxel } from './model';
import { createHistory } from './history';
import { decodeModel, encodeModel } from './io';

function seedModel() {
  const m = createModel(3, 4, 5);
  setVoxel(m, 0, 0, 0, 1);
  setVoxel(m, 1, 2, 3, 7);
  setVoxel(m, 2, 3, 4, 255);
  m.palette[0] = 0x11;
  m.palette[1] = 0x22;
  m.palette[2] = 0x33;
  m.palette[3] = 0xff;
  return m;
}

describe('io', () => {
  it('round-trips a model with empty history', () => {
    const m = seedModel();
    const bytes = encodeModel(m, { undoStack: [], redoStack: [] });
    const { model, history } = decodeModel(bytes);
    expect(model.sx).toBe(3);
    expect(model.sy).toBe(4);
    expect(model.sz).toBe(5);
    expect(Array.from(model.voxels)).toEqual(Array.from(m.voxels));
    expect(Array.from(model.palette)).toEqual(Array.from(m.palette));
    expect(history.undo).toEqual([]);
    expect(history.redo).toEqual([]);
  });

  it('round-trips history snapshots in order', () => {
    const m = seedModel();
    const h = createHistory();
    h.push(m.voxels);
    setVoxel(m, 0, 0, 0, 9);
    h.push(m.voxels);
    setVoxel(m, 0, 0, 0, 10);
    h.undo(m.voxels);
    const bytes = encodeModel(m, h);
    const decoded = decodeModel(bytes);
    expect(decoded.history.undo.length).toBe(h.undoStack.length);
    expect(decoded.history.redo.length).toBe(h.redoStack.length);
    for (let i = 0; i < h.undoStack.length; i++) {
      expect(Array.from(decoded.history.undo[i]!)).toEqual(Array.from(h.undoStack[i]!));
    }
    for (let i = 0; i < h.redoStack.length; i++) {
      expect(Array.from(decoded.history.redo[i]!)).toEqual(Array.from(h.redoStack[i]!));
    }
  });

  it('decoded slices are decoupled from the source buffer', () => {
    const m = seedModel();
    const bytes = encodeModel(m, { undoStack: [], redoStack: [] });
    const { model } = decodeModel(bytes);
    bytes.fill(0);
    expect(model.voxels.some((v) => v !== 0)).toBe(true);
    expect(model.palette.some((v) => v !== 0)).toBe(true);
  });

  it('rejects a file with bad magic', () => {
    const m = seedModel();
    const bytes = encodeModel(m, { undoStack: [], redoStack: [] });
    bytes[0] = 0x00;
    expect(() => decodeModel(bytes)).toThrow(/magic/);
  });

  it('rejects an unsupported version', () => {
    const m = seedModel();
    const bytes = encodeModel(m, { undoStack: [], redoStack: [] });
    bytes[4] = 99;
    expect(() => decodeModel(bytes)).toThrow(/version/);
  });

  it('rejects a file truncated before the redo header', () => {
    const m = seedModel();
    const bytes = encodeModel(m, { undoStack: [], redoStack: [] });
    expect(() => decodeModel(bytes.slice(0, bytes.length - 2))).toThrow(/truncated/);
  });

  it('rejects a file with trailing bytes', () => {
    const m = seedModel();
    const bytes = encodeModel(m, { undoStack: [], redoStack: [] });
    const padded = new Uint8Array(bytes.length + 3);
    padded.set(bytes);
    expect(() => decodeModel(padded)).toThrow(/trailing/);
  });

  it('rejects an out-of-range dimension', () => {
    const m = seedModel();
    const bytes = encodeModel(m, { undoStack: [], redoStack: [] });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint16(6, 2048, true);
    expect(() => decodeModel(bytes)).toThrow(/dimension/);
  });

  it('rejects an undo count that exceeds the remaining file', () => {
    const m = seedModel();
    const bytes = encodeModel(m, { undoStack: [], redoStack: [] });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint32(bytes.length - 8, 99, true);
    expect(() => decodeModel(bytes)).toThrow(/undo count/);
  });

  it('rejects a snapshot length mismatch during encode', () => {
    const m = seedModel();
    expect(() => encodeModel(m, { undoStack: [new Uint8Array(2)], redoStack: [] })).toThrow(
      /snapshot length/,
    );
  });
});
