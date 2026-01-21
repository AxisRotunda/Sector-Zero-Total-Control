export class ObjectPool<T> {
  private available: T[] = [];
  private active = new Set<T>();

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    initialSize: number = 50
  ) {
    this.expand(initialSize);
  }

  private expand(count: number) {
    for (let i = 0; i < count; i++) {
      this.available.push(this.factory());
    }
  }

  acquire(): T {
    if (this.available.length === 0) {
      this.expand(Math.max(10, Math.ceil(this.active.size * 0.2)));
    }
    const obj = this.available.pop()!;
    this.active.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (this.active.delete(obj)) {
      this.reset(obj);
      this.available.push(obj);
    }
  }

  releaseAll(): void {
    this.active.forEach(obj => {
      this.reset(obj);
      this.available.push(obj);
    });
    this.active.clear();
  }

  getActiveCount(): number {
    return this.active.size;
  }
}