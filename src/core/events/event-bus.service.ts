import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { GameEvent } from './game-events';

@Injectable({
  providedIn: 'root'
})
export class EventBusService {
  private eventBus = new Subject<GameEvent>();

  /**
   * Dispatch a typed event to the bus.
   */
  dispatch(event: GameEvent): void {
    this.eventBus.next(event);
  }

  /**
   * Subscribe to events of a specific type with type inference.
   */
  on<T extends GameEvent['type']>(eventType: T): Observable<Extract<GameEvent, { type: T }>['payload']> {
    return this.eventBus.asObservable().pipe(
      filter(event => event.type === eventType),
      map(event => (event as any).payload)
    );
  }
}