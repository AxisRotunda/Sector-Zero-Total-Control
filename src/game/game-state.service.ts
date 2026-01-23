
import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  // Shared state that both GameEngine and UI need to access
  isInMenu = signal(true);
}
