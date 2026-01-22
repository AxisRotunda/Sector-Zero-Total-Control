
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class IdGeneratorService {
  private nextId = 0;

  generateNumericId(): number {
    return this.nextId++;
  }

  generateStringId(): string {
    return (this.nextId++).toString(36);
  }

  /**
   * Updates the internal counter to ensure future IDs are greater than the provided ID.
   * Critical for restoring state from snapshots.
   */
  updateHead(id: number) {
    if (id >= this.nextId) {
      this.nextId = id + 1;
    }
  }
}
