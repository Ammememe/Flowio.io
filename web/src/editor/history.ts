/**
 * P3-8: undo/redo. A plain stack of whole-deck snapshots -- decks are
 * small, so cloning the lot is simpler and more reliable than diffing.
 * `main.ts` decides when to push a checkpoint: immediately after a
 * structural change (add/delete/reorder slide, layout/theme change), and
 * debounced after text edits settle.
 */
export class History<T> {
  private stack: T[] = [];
  private index = -1;

  constructor(private readonly limit = 50) {}

  push(state: T): void {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(structuredClone(state));
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  undo(): T | undefined {
    if (!this.canUndo()) return undefined;
    this.index -= 1;
    return structuredClone(this.stack[this.index]);
  }

  redo(): T | undefined {
    if (!this.canRedo()) return undefined;
    this.index += 1;
    return structuredClone(this.stack[this.index]);
  }
}
