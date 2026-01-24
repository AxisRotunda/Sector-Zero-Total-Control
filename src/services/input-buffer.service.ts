
import { Injectable, OnDestroy } from '@angular/core';
import { CommandType, COMBO_DEFINITIONS, ComboDefinition } from '../config/combo.config';

export type { CommandType };

export interface BufferedCommand {
    type: CommandType;
    angle?: number;
    timestamp: number;
    priority: number; // Higher executes first
}

interface InputHistoryItem {
    action: CommandType;
    timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class InputBufferService implements OnDestroy {
  private buffer: BufferedCommand[] = [];
  
  // Ring Buffer for History (Fixed size to avoid reallocation)
  private readonly HISTORY_SIZE = 10;
  private inputRing: InputHistoryItem[] = new Array(this.HISTORY_SIZE).fill(null);
  private ringIndex = 0; // Points to the next empty slot
  private historyCount = 0; // Tracks logical size up to HISTORY_SIZE
  
  private readonly BUFFER_TTL = 300; // ms to keep command alive
  private readonly MAX_BUFFER_SIZE = 3;

  private combos: ComboDefinition[] = COMBO_DEFINITIONS;

  ngOnDestroy() {
      this.buffer = [];
      this.inputRing = [];
  }

  /**
   * Adds a command to the buffer.
   * If the buffer is full, it prioritizes the new command if it has higher/equal priority,
   * or replaces the oldest command.
   */
  addCommand(type: CommandType, angle?: number, priority: number = 1) {
      const now = performance.now();
      
      // 1. Regular Buffering (Fix: Buffer *before* checking combos to prevent lost input race)
      this.prune(now);

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

      // 2. Record History for Combos (Ring Buffer Push)
      this.inputRing[this.ringIndex] = { action: type, timestamp: now };
      this.ringIndex = (this.ringIndex + 1) % this.HISTORY_SIZE;
      this.historyCount = Math.min(this.historyCount + 1, this.HISTORY_SIZE);
      
      // 3. Check for Combos
      // If a combo triggers, we keep the buffer intact (the trigger input might be needed individually)
      // but the combo result is added as a HIGH PRIORITY command.
      if (this.checkCombos(now, type)) {
          // Clear history after successful combo to prevent overlap triggering
          this.clearHistory();
      }
  }

  private checkCombos(now: number, lastAction: CommandType): boolean {
    for (const combo of this.combos) {
      // Optimization: Fast fail if last input doesn't match combo end
      if (lastAction !== combo.sequence[combo.sequence.length - 1]) continue;
        
      if (this.historyCount < combo.sequence.length) continue;

      // Extract recent sequence from Ring Buffer
      // We need to walk backwards from current ringIndex
      let match = true;
      let startTime = 0;
      let endTime = 0;

      const seqLen = combo.sequence.length;
      
      for (let i = 0; i < seqLen; i++) {
          // Calculate circular index walking back: (ringIndex - 1 - i + Size) % Size
          const idx = (this.ringIndex - 1 - i + this.HISTORY_SIZE) % this.HISTORY_SIZE;
          const historyItem = this.inputRing[idx];
          const sequenceChar = combo.sequence[seqLen - 1 - i]; // Match backwards
          
          if (historyItem.action !== sequenceChar) {
              match = false;
              break;
          }
          
          if (i === 0) endTime = historyItem.timestamp;
          if (i === seqLen - 1) startTime = historyItem.timestamp;
      }
      
      if (!match) continue;
      
      // Check timing window
      const duration = endTime - startTime;
      if (duration <= combo.windowMs) {
        this.triggerCombo(combo.result);
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
      this.clearHistory();
  }
  
  private clearHistory() {
      this.historyCount = 0;
      this.ringIndex = 0;
      // No need to null out array, just resetting count is sufficient logic reset
  }

  private prune(now: number) {
      this.buffer = this.buffer.filter(cmd => now - cmd.timestamp < this.BUFFER_TTL);
  }
}
