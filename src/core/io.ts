import type { Model } from './model';
import { PALETTE_BYTES } from './model';

const MAGIC = new Uint8Array([0x42, 0x54, 0x42, 0x55]);
const VERSION = 1;
const MAX_DIM = 1024;
const HEADER_BYTES = 4 + 1 + 1 + 2 + 2 + 2 + PALETTE_BYTES;
const PALETTE_OFFSET = 12;
const VOXELS_OFFSET = HEADER_BYTES;

export interface EncodableHistory {
  readonly undoStack: ReadonlyArray<Uint8Array>;
  readonly redoStack: ReadonlyArray<Uint8Array>;
}

export interface DecodedModel {
  model: Model;
  history: { undo: Uint8Array[]; redo: Uint8Array[] };
}

export function encodeModel(model: Model, history: EncodableHistory): Uint8Array {
  const n = model.voxels.length;
  for (const s of history.undoStack) assertSnapshotLength(s, n);
  for (const s of history.redoStack) assertSnapshotLength(s, n);

  const total =
    HEADER_BYTES + n + 4 + n * history.undoStack.length + 4 + n * history.redoStack.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  out.set(MAGIC, 0);
  out[4] = VERSION;
  out[5] = 0;
  view.setUint16(6, model.sx, true);
  view.setUint16(8, model.sy, true);
  view.setUint16(10, model.sz, true);
  out.set(model.palette, PALETTE_OFFSET);
  out.set(model.voxels, VOXELS_OFFSET);

  let offset = VOXELS_OFFSET + n;
  view.setUint32(offset, history.undoStack.length, true);
  offset += 4;
  for (const snap of history.undoStack) {
    out.set(snap, offset);
    offset += n;
  }
  view.setUint32(offset, history.redoStack.length, true);
  offset += 4;
  for (const snap of history.redoStack) {
    out.set(snap, offset);
    offset += n;
  }

  return out;
}

export function decodeModel(bytes: Uint8Array): DecodedModel {
  if (bytes.length < HEADER_BYTES) {
    throw new Error('file too small to contain header');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error('not a .buu file (bad magic)');
  }
  const version = bytes[4]!;
  if (version !== VERSION) {
    throw new Error(`unsupported .buu version ${version} (expected ${VERSION})`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sx = view.getUint16(6, true);
  const sy = view.getUint16(8, true);
  const sz = view.getUint16(10, true);
  if (sx < 1 || sy < 1 || sz < 1 || sx > MAX_DIM || sy > MAX_DIM || sz > MAX_DIM) {
    throw new Error(`dimension out of range: ${sx}x${sy}x${sz} (max ${MAX_DIM})`);
  }
  const n = sx * sy * sz;

  if (bytes.length < HEADER_BYTES + n + 4) {
    throw new Error('file truncated before history header');
  }

  const palette = bytes.slice(PALETTE_OFFSET, PALETTE_OFFSET + PALETTE_BYTES);
  const voxels = bytes.slice(VOXELS_OFFSET, VOXELS_OFFSET + n);

  let offset = VOXELS_OFFSET + n;
  const undoCount = view.getUint32(offset, true);
  offset += 4;
  const undoBytesAvailable = bytes.length - offset - 4;
  if (undoBytesAvailable < 0) {
    throw new Error('file truncated before redo header');
  }
  if (undoCount > Math.floor(undoBytesAvailable / n)) {
    throw new Error(`undo count ${undoCount} exceeds remaining file size`);
  }
  const undo: Uint8Array[] = [];
  for (let i = 0; i < undoCount; i++) {
    undo.push(bytes.slice(offset, offset + n));
    offset += n;
  }

  const redoCount = view.getUint32(offset, true);
  offset += 4;
  if (redoCount > Math.floor((bytes.length - offset) / n)) {
    throw new Error(`redo count ${redoCount} exceeds remaining file size`);
  }
  const redo: Uint8Array[] = [];
  for (let i = 0; i < redoCount; i++) {
    redo.push(bytes.slice(offset, offset + n));
    offset += n;
  }

  if (offset !== bytes.length) {
    throw new Error(`trailing bytes: ${bytes.length - offset}`);
  }

  const model: Model = { sx, sy, sz, voxels, palette };
  return { model, history: { undo, redo } };
}

function assertSnapshotLength(snap: Uint8Array, n: number): void {
  if (snap.length !== n) {
    throw new Error(`history snapshot length ${snap.length} does not match voxel count ${n}`);
  }
}
