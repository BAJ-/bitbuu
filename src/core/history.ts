export interface HistoryInit {
  readonly undo: ReadonlyArray<Uint8Array>;
  readonly redo: ReadonlyArray<Uint8Array>;
}

export interface History {
  push(state: Uint8Array): void;
  undo(current: Uint8Array): Uint8Array | null;
  redo(current: Uint8Array): Uint8Array | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoStack: ReadonlyArray<Uint8Array>;
  readonly redoStack: ReadonlyArray<Uint8Array>;
}

export function createHistory(initial?: HistoryInit): History {
  const undoStack: Uint8Array[] = initial ? initial.undo.map((s) => new Uint8Array(s)) : [];
  const redoStack: Uint8Array[] = initial ? initial.redo.map((s) => new Uint8Array(s)) : [];

  return {
    push(state) {
      undoStack.push(new Uint8Array(state));
      redoStack.length = 0;
    },
    undo(current) {
      const prev = undoStack.pop();
      if (!prev) return null;
      redoStack.push(new Uint8Array(current));
      return prev;
    },
    redo(current) {
      const next = redoStack.pop();
      if (!next) return null;
      undoStack.push(new Uint8Array(current));
      return next;
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    get undoStack() {
      return undoStack;
    },
    get redoStack() {
      return redoStack;
    },
  };
}
