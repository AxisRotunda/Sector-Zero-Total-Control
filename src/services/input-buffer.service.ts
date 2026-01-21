
import { Injectable } from '@angular/core';

export type CommandType = 'PRIMARY' | 'SECONDARY' | 'UTILITY' | 'DASH' | 'OVERLOAD';

export interface BufferedCommand {
    type: CommandType;
    angle?: number;
    timestamp: number;
    priority: number; // Higher executes first
}

@Injectable({
  providedIn: 'root'
})
export class InputBufferService {
  private buffer: BufferedCommand[] = [];
  private readonly BUFFER_TTL = 300; // ms to keep command alive
  private readonly MAX_BUFFER_SIZE = 3;

  /**
   * Adds a command to the buffer.
   * If the buffer is full, it prioritizes the new command if it has higher/equal priority,
   * or replaces the oldest command.
   */
  addCommand(type: CommandType, angle?: number, priority: number = 1) {
      const now = performance.now();
      
      // Cleanup expired
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
  }

  private prune(now: number) {
      this.buffer = this.buffer.filter(cmd => now - cmd.timestamp < this.BUFFER_TTL);
  }
}
