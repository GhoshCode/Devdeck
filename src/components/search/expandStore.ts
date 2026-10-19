import { useSyncExternalStore } from 'react';

// Which bookmark folders are open. Each row subscribes to its own folder only,
// so opening one folder re-renders that one row — not the thousands around it.
// "Expand all" opens folders in small batches, one batch per animation frame,
// so even huge collections never freeze the page.

const BATCH = 24;

export class ExpandStore {
  private open = new Set<string>();
  private byId = new Map<string, Set<() => void>>();
  private any = new Set<() => void>();
  private version = 0;
  private job = 0;

  isOpen = (id: string) => this.open.has(id);
  getVersion = () => this.version;
  count = () => this.open.size;

  subscribe = (id: string, fn: () => void) => {
    let set = this.byId.get(id);
    if (!set) this.byId.set(id, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
    };
  };
  subscribeAny = (fn: () => void) => {
    this.any.add(fn);
    return () => {
      this.any.delete(fn);
    };
  };

  private emit(ids: Iterable<string>) {
    this.version++;
    for (const id of ids) this.byId.get(id)?.forEach((fn) => fn());
    this.any.forEach((fn) => fn());
  }

  set(id: string, value: boolean) {
    if (this.open.has(id) === value) return;
    if (value) this.open.add(id);
    else this.open.delete(id);
    this.emit([id]);
  }
  toggle = (id: string) => this.set(id, !this.open.has(id));
  reveal = (id: string) => this.set(id, true);

  // Open exactly these folders. Large changes run in per-frame batches: closing
  // deepest-first, then opening parents-first (rows appear top-down).
  openOnly(ids: readonly string[], progressive = false) {
    cancelAnimationFrame(this.job);
    const want = new Set(ids);
    // closing: deepest first (reverse of the parents-first order), so each
    // batch unmounts only small subtrees
    const closing = [...this.open].filter((id) => !want.has(id)).reverse();
    const opening = ids.filter((id) => !this.open.has(id));
    if (!progressive && closing.length + opening.length <= BATCH * 3) {
      closing.forEach((id) => this.open.delete(id));
      opening.forEach((id) => this.open.add(id));
      this.emit([...closing, ...opening]);
      return;
    }
    const steps: Array<() => string[]> = [];
    for (let i = 0; i < closing.length; i += BATCH) {
      const batch = closing.slice(i, i + BATCH);
      steps.push(() => (batch.forEach((id) => this.open.delete(id)), batch));
    }
    for (let i = 0; i < opening.length; i += BATCH) {
      const batch = opening.slice(i, i + BATCH);
      steps.push(() => (batch.forEach((id) => this.open.add(id)), batch));
    }
    if (!steps.length) return;
    let k = 0;
    const step = () => {
      this.emit(steps[k++]());
      if (k < steps.length) this.job = requestAnimationFrame(step);
    };
    step();
  }
  dispose() {
    cancelAnimationFrame(this.job);
  }
}

export function useFolderOpen(store: ExpandStore, id: string): boolean {
  return useSyncExternalStore(
    (fn) => store.subscribe(id, fn),
    () => store.isOpen(id),
  );
}

export function useExpandVersion(store: ExpandStore): number {
  return useSyncExternalStore(store.subscribeAny, store.getVersion);
}
