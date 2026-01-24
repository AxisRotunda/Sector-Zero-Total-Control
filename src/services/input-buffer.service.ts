
import { Injectable } from '@angular/core';

export type CommandType = 'PRIMARY' | 'SECONDARY' | 'UTILITY' | 'DASH' | 'OVERLOAD' | 'SHIELD_BASH' | 'WHIRLWIND' | 'DASH_STRIKE';

export interface BufferedCommand {
    type: CommandType;
    angle?: number;
    timestamp: number;
    priority: number; // Higher executes first
}

export interface ComboDefinition {
  sequence: CommandType[];
  windowMs: number;
  result: CommandType;
}

@Injectable({
  providedIn: 'root'
})
export class InputBufferService {
  private buffer: BufferedCommand[] = [];
  private inputHistory: Array<{ action: CommandType, timestamp: number }> = [];
  
  private readonly BUFFER_TTL = 300; // ms to keep command alive
  private readonly MAX_BUFFER_SIZE = 3;

  private combos: ComboDefinition[] = [
    { sequence: ['PRIMARY', 'SECONDARY', 'DASH'], windowMs: 600, result: 'WHIRLWIND' },
    { sequence: ['DASH', 'PRIMARY', 'PRIMARY'], windowMs: 800, result: 'DASH_STRIKE' }
  ];

  /**
   * Adds a command to the buffer.
   * If the buffer is full, it prioritizes the new command if it has higher/equal priority,
   * or replaces the oldest command.
   */
  addCommand(type: CommandType, angle?: number, priority: number = 1) {
      const now = performance.now();
      
      // 1. Record History for Combos
      this.inputHistory.push({ action: type, timestamp: now });
      // Clean up old history (keep last 1s)
      this.inputHistory = this.inputHistory.filter(i => now - i.timestamp < 1000);
      
      // 2. Check for Combos
      if (this.checkCombos(now)) {
          return; // If combo triggered, don't buffer the raw input
      }

      // 3. Regular Buffering
      this.prune(now);

      // Add new
      this.buffer.push({ type, angle, timestamp: now, priority });
      
      // Sort by priority desc, then timestamp asc
      this.buffer.sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return a.timestamp - b.timestamp;
      });

      // Cap size
      if (this.buffer.length > this.MAX_BUFFER_SIZE) {
          this.buffer.pop(); // Remove lowest priority/oldest
      }
  }

  private checkCombos(now: number): boolean {
    for (const combo of this.combos) {
      if (this.inputHistory.length < combo.sequence.length) continue;

      const recent = this.inputHistory.slice(-combo.sequence.length);
      
      // Check sequence match
      const matches = recent.every((input, i) => input.action === combo.sequence[i]);
      if (!matches) continue;
      
      // Check timing window
      const duration = recent[recent.length - 1].timestamp - recent[0].timestamp;
      if (duration <= combo.windowMs) {
        this.triggerCombo(combo.result);
        this.inputHistory = []; // Clear history after combo
        return true;
      }
    }
    return false;
  }

  private triggerCombo(comboName: CommandType) {
      // Add as high-priority command immediately
      // Using priority 5 ensures it overrides standard inputs
      this.buffer.push({ 
          type: comboName, 
          timestamp: performance.now(), 
          priority: 5 
      });
  }

  /**
   * Retrieves and removes the next valid command from the buffer.
   */
  consumeCommand(): BufferedCommand | null {
      this.prune(performance.now());
      return this.buffer.shift() || null;
  }

  /**
   * Peeks at the next command without removing it.
   */
  peekCommand(): BufferedCommand | null {
      this.prune(performance.now());
      return this.buffer[0] || null;
  }

  clear() {
      this.buffer = [];
      this.inputHistory = [];
  }

  private prune(now: number) {
      this.buffer = this.buffer.filter(cmd => now - cmd.timestamp < this.BUFFER_TTL);
  }
}
