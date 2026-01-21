import { Injectable, signal } from '@angular/core';

export interface TutorialStep {
  id: string; title: string; content: string; trigger: 'START' | 'COMBAT' | 'INVENTORY' | 'LEVEL_UP'; seen: boolean;
}

@Injectable({ providedIn: 'root' })
export class TutorialService {
  activeTutorial = signal<TutorialStep | null>(null);
  private steps: TutorialStep[] = [
    { id: 'movement', title: 'NEURAL LINK ESTABLISHED', content: 'Use the left joystick to move.', trigger: 'START', seen: false },
    { id: 'combat', title: 'THREAT DETECTED', content: 'Enemies engage automatically. Tap Action Button to force attack.', trigger: 'COMBAT', seen: false },
    { id: 'inventory', title: 'GEAR MANAGEMENT', content: 'Tap items to view details. HOLD and DRAG to equip.', trigger: 'INVENTORY', seen: false }
  ];

  constructor() {
    this.loadProgress();
  }

  trigger(triggerType: string) {
    const step = this.steps.find(s => s.trigger === triggerType && !s.seen);
    if (step) { 
        this.activeTutorial.set(step); 
        step.seen = true;
        this.saveProgress();
    }
  }

  dismiss() { this.activeTutorial.set(null); }
  
  skipAll() { 
      this.steps.forEach(s => s.seen = true); 
      this.activeTutorial.set(null); 
      this.saveProgress();
  }

  private saveProgress() {
      const seen = this.steps.filter(s => s.seen).map(s => s.id);
      localStorage.setItem('sector_zero_tutorial', JSON.stringify(seen));
  }

  private loadProgress() {
      const stored = localStorage.getItem('sector_zero_tutorial');
      if (stored) {
          try {
              const seenIds = JSON.parse(stored) as string[];
              this.steps.forEach(step => {
                  if (seenIds.includes(step.id)) step.seen = true;
              });
          } catch (e) {}
      }
  }
}