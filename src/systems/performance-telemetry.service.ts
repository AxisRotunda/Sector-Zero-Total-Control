
import { Injectable, signal, computed } from '@angular/core';

interface FrameMetrics {
  fps: number;
  frameTime: number;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class PerformanceTelemetryService {
  private frameHistory: FrameMetrics[] = [];
  private maxHistorySize = 120; // 2s at 60fps

  currentFps = signal(60);
  avgFrameTime = signal(16.66);

  // Computed health indicators
  isUnstable = computed(() => this.currentFps() < 50);
  isCritical = computed(() => this.currentFps() < 30);
  
  frameBudgetUsage = computed(() => {
    const used = this.avgFrameTime();
    const budget = 16.66; // 60fps target
    return (used / budget) * 100;
  });

  recordFrame(frameTime: number): void {
    // Avoid division by zero
    if (frameTime <= 0) return;
    
    const fps = 1000 / frameTime;
    
    this.frameHistory.push({
      fps,
      frameTime,
      timestamp: performance.now()
    });

    // Trim history
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }

    // Update signals periodically (every 10 frames) to reduce signal churn
    if (this.frameHistory.length % 10 === 0) {
        this.currentFps.set(fps);
        const avg = this.frameHistory.reduce((sum, f) => sum + f.frameTime, 0) / this.frameHistory.length;
        this.avgFrameTime.set(avg);
    }
  }

  /**
   * Detect performance degradation trends (leading indicator)
   */
  getTrend(): 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'CRITICAL' {
    if (this.frameHistory.length < 60) return 'STABLE';

    const recent = this.frameHistory.slice(-30); // Last 0.5s
    const older = this.frameHistory.slice(-60, -30); // Previous 0.5s

    const recentAvg = recent.reduce((s, f) => s + f.frameTime, 0) / recent.length;
    const olderAvg = older.reduce((s, f) => s + f.frameTime, 0) / older.length;

    const delta = recentAvg - olderAvg;

    if (delta > 3) return 'CRITICAL'; // Rapidly worsening
    if (delta > 1) return 'DEGRADING'; // Slowly worsening
    if (delta < -1) return 'IMPROVING';
    return 'STABLE';
  }

  getStats() {
    return {
      fps: this.currentFps(),
      avgFrameTime: this.avgFrameTime().toFixed(2),
      budgetUsage: this.frameBudgetUsage().toFixed(0),
      trend: this.getTrend(),
      isUnstable: this.isUnstable(),
      isCritical: this.isCritical()
    };
  }
}
