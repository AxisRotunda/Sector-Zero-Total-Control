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
}