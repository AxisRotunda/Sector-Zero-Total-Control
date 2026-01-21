
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class InputValidatorService {

  validateVector(vec: {x: number, y: number}, context: string = 'Physics'): {x: number, y: number} {
    let { x, y } = vec;
    
    if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
        console.warn(`[InputValidator] Invalid vector detected in ${context}:`, vec);
        return { x: 0, y: 0 };
    }

    // Clamp huge values to prevent physics explosions
    const MAX_VAL = 10000; 
    if (Math.abs(x) > MAX_VAL) x = Math.sign(x) * MAX_VAL;
    if (Math.abs(y) > MAX_VAL) y = Math.sign(y) * MAX_VAL;

    return { x, y };
  }

  validateNumber(val: number, fallback: number = 0): number {
      if (isNaN(val) || !isFinite(val)) return fallback;
      return val;
  }
}
