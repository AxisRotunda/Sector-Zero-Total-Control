
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HapticService {
  
  vibrate(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Haptics not supported or blocked
      }
    }
  }

  // Tuned Presets
  impactLight() { this.vibrate(5); } // Very sharp click
  impactMedium() { this.vibrate(15); }
  impactHeavy() { this.vibrate([30, 20, 30]); } // Thud
  explosion() { this.vibrate([50, 30, 50, 30, 80]); } // Rumble
  error() { this.vibrate([30, 50, 30]); } // Buzz
  success() { this.vibrate([10, 30, 10]); } // Chirp
  heartbeat() { this.vibrate([10, 100, 10]); } // Subtle pulse
}
