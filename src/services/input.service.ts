
import { Injectable, signal, OnDestroy } from '@angular/core';
import { Subject, Observable, fromEvent, merge } from 'rxjs';
import { map, filter, throttleTime } from 'rxjs/operators';

export type Action = 
  | 'MOVE_UP' | 'MOVE_DOWN' | 'MOVE_LEFT' | 'MOVE_RIGHT'
  | 'ATTACK' | 'INTERACT' 
  | 'SKILL_1' | 'SKILL_2' | 'SKILL_3' | 'SKILL_4'
  | 'TOGGLE_INV' | 'TOGGLE_MAP' | 'TOGGLE_SKILLS' | 'TOGGLE_PSI' | 'TOGGLE_CODEX' | 'TOGGLE_SHOP' | 'MENU';

export const DEFAULT_BINDINGS: Record<Action, string> = {
  'MOVE_UP': 'w',
  'MOVE_DOWN': 's',
  'MOVE_LEFT': 'a',
  'MOVE_RIGHT': 'd',
  'ATTACK': ' ',
  'INTERACT': 'f',
  'SKILL_1': 'e',
  'SKILL_2': 'r',
  'SKILL_3': 'Shift',
  'SKILL_4': 'q',
  'TOGGLE_INV': 'i',
  'TOGGLE_MAP': 'm',
  'TOGGLE_SKILLS': 'n',
  'TOGGLE_PSI': 'u',
  'TOGGLE_CODEX': 'l',
  'TOGGLE_SHOP': 'p',
  'MENU': 'Escape'
};

export interface InputState {
    vector: { x: number, y: number };
    aimAngle: number | null;
    isAttacking: boolean;
    activeActions: Set<Action>;
}

@Injectable({
  providedIn: 'root'
})
export class InputService {
  inputVector = { x: 0, y: 0 };
  aimAngle: number | null = null;
  
  usingKeyboard = signal(false);
  usingGamepad = signal(false);
  
  isAttackPressed = false; 
  
  bindings = signal<Record<Action, string>>({ ...DEFAULT_BINDINGS });
  
  actionEvents = new Subject<Action>();
  zoomEvents = new Subject<number>(); // Delta value

  private inputState$ = new Subject<InputState>();
  private activeKeys = new Set<string>();
  private activeActions = new Set<Action>();
  private canvasRef: HTMLCanvasElement | null = null;

  // Touch Zoom State
  private initialPinchDist: number | null = null;

  // Gamepad State
  private gamepadIndex: number | null = null;
  private gamepadState = {
      buttons: new Array(16).fill(false),
      axes: [0, 0, 0, 0]
  };
  private readonly DEADZONE = 0.15;

  constructor() {
    this.loadBindings();
    this.initListeners();
    this.initGamepad();
  }

  setCanvas(canvas: HTMLCanvasElement) {
    this.canvasRef = canvas;
    this.initTouchZoom(canvas);
  }

  private initListeners() {
    fromEvent<KeyboardEvent>(window, 'keydown').subscribe(e => this.handleKeyDown(e));
    fromEvent<KeyboardEvent>(window, 'keyup').subscribe(e => this.handleKeyUp(e));
    fromEvent<MouseEvent>(window, 'mousemove').subscribe(e => this.handleMouseMove(e));
    
    // Mouse Wheel Zoom
    fromEvent<WheelEvent>(window, 'wheel', { passive: false }).subscribe(e => {
        if (e.ctrlKey || !this.canvasRef) return; // Allow browser zoom if ctrl is held
        // e.preventDefault(); // Optional: prevent page scroll
        this.zoomEvents.next(e.deltaY);
    });
    
    fromEvent<MouseEvent>(window, 'mousedown').subscribe(e => {
        if (e.button === 0) {
            this.isAttackPressed = true;
            this.activeActions.add('ATTACK');
            this.emitState();
        }
    });
    
    fromEvent<MouseEvent>(window, 'mouseup').subscribe(e => {
        this.isAttackPressed = false;
        this.activeActions.delete('ATTACK');
        this.emitState();
    });
  }

  private initTouchZoom(canvas: HTMLCanvasElement) {
      canvas.addEventListener('touchmove', (e) => {
          if (e.touches.length === 2) {
              e.preventDefault(); // Prevent page scroll
              const dist = Math.hypot(
                  e.touches[0].clientX - e.touches[1].clientX,
                  e.touches[0].clientY - e.touches[1].clientY
              );

              if (this.initialPinchDist === null) {
                  this.initialPinchDist = dist;
              } else {
                  const delta = this.initialPinchDist - dist;
                  this.zoomEvents.next(delta * 5); // Multiplier to match wheel sensitivity roughly
                  this.initialPinchDist = dist;
              }
          }
      }, { passive: false });

      canvas.addEventListener('touchend', (e) => {
          if (e.touches.length < 2) {
              this.initialPinchDist = null;
          }
      });
  }

  private initGamepad() {
      window.addEventListener("gamepadconnected", (e) => {
          console.log("Gamepad connected:", e.gamepad.id);
          this.gamepadIndex = e.gamepad.index;
          this.pollGamepad();
      });

      window.addEventListener("gamepaddisconnected", (e) => {
          if (this.gamepadIndex === e.gamepad.index) {
              this.gamepadIndex = null;
              this.usingGamepad.set(false);
          }
      });
  }

  isDown(action: Action): boolean {
    return this.activeActions.has(action);
  }

  getInputState() {
      return this.inputState$.asObservable();
  }

  getBinding(action: Action): string {
    return this.bindings()[action];
  }

  rebind(action: Action, key: string) {
    const newBindings = { ...this.bindings(), [action]: key };
    this.bindings.set(newBindings);
    localStorage.setItem('sector_zero_bindings', JSON.stringify(newBindings));
  }

  resetBindings() {
    this.bindings.set({ ...DEFAULT_BINDINGS });
    localStorage.removeItem('sector_zero_bindings');
  }

  setJoystick(x: number, y: number) {
      this.inputVector = { x, y };
      this.usingKeyboard.set(false);
      this.usingGamepad.set(false);
      this.emitState();
  }

  setAttackState(isAttacking: boolean) {
      this.isAttackPressed = isAttacking;
      if(isAttacking) this.activeActions.add('ATTACK');
      else this.activeActions.delete('ATTACK');
      this.emitState();
  }

  private emitState() {
      this.inputState$.next({
          vector: this.inputVector,
          aimAngle: this.aimAngle,
          isAttacking: this.isAttackPressed,
          activeActions: new Set(this.activeActions)
      });
  }

  private loadBindings() {
    const stored = localStorage.getItem('sector_zero_bindings');
    if (stored) {
      try {
        this.bindings.set({ ...DEFAULT_BINDINGS, ...JSON.parse(stored) });
      } catch (e) { console.error('Failed to load bindings'); }
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    const key = e.key; 
    this.activeKeys.add(key.toLowerCase());
    const action = this.getActionFromKey(key);
    if (action) {
      this.activeActions.add(action);
      this.actionEvents.next(action);
      if (['MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT'].includes(action)) {
        this.usingKeyboard.set(true);
        this.usingGamepad.set(false);
        this.updateVector();
      }
      this.emitState();
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    const key = e.key;
    this.activeKeys.delete(key.toLowerCase());
    const action = this.getActionFromKey(key);
    if (action) {
      this.activeActions.delete(action);
      if (['MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT'].includes(action)) {
        this.updateVector();
      }
      this.emitState();
    }
  }

  private getActionFromKey(key: string): Action | undefined {
    const lowerKey = key.toLowerCase();
    const map = this.bindings();
    return (Object.keys(map) as Action[]).find(a => map[a].toLowerCase() === lowerKey);
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.canvasRef || this.usingGamepad()) return;
    
    const rect = this.canvasRef.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const dx = mouseX - canvasCenterX;
    const dy = mouseY - canvasCenterY;
    
    this.aimAngle = Math.atan2(dy, dx);
  }

  private updateVector() {
      if (this.usingGamepad()) return;
      
      let x = 0; let y = 0;
      if (this.isDown('MOVE_UP')) y -= 1;
      if (this.isDown('MOVE_DOWN')) y += 1;
      if (this.isDown('MOVE_LEFT')) x -= 1;
      if (this.isDown('MOVE_RIGHT')) x += 1;
      
      const len = Math.hypot(x, y);
      if (len > 0) { x /= len; y /= len; }
      this.inputVector = { x, y };
  }

  private pollGamepad() {
      if (this.gamepadIndex === null) return;

      const gamepad = navigator.getGamepads()[this.gamepadIndex];
      if (!gamepad) return;

      // --- AXES ---
      const lx = gamepad.axes[0];
      const ly = gamepad.axes[1];
      const rx = gamepad.axes[2];
      const ry = gamepad.axes[3];

      if (Math.abs(lx) > this.DEADZONE || Math.abs(ly) > this.DEADZONE) {
          this.inputVector = { x: lx, y: ly };
          this.usingGamepad.set(true);
          this.usingKeyboard.set(false);
      } else if (this.usingGamepad()) {
          this.inputVector = { x: 0, y: 0 };
      }

      if (Math.abs(rx) > this.DEADZONE || Math.abs(ry) > this.DEADZONE) {
          this.aimAngle = Math.atan2(ry, rx);
          this.usingGamepad.set(true);
      }

      // --- BUTTONS ---
      const mapButton = (btnIndex: number, action: Action) => {
          const pressed = gamepad.buttons[btnIndex].pressed;
          if (pressed && !this.gamepadState.buttons[btnIndex]) {
              this.activeActions.add(action);
              this.actionEvents.next(action);
              if (action === 'ATTACK') this.isAttackPressed = true;
              this.emitState();
          } else if (!pressed && this.gamepadState.buttons[btnIndex]) {
              this.activeActions.delete(action);
              if (action === 'ATTACK') this.isAttackPressed = false;
              this.emitState();
          }
          this.gamepadState.buttons[btnIndex] = pressed;
      };

      mapButton(0, 'ATTACK'); // A
      mapButton(1, 'SKILL_3'); // B (Dash)
      mapButton(2, 'INTERACT'); // X
      mapButton(3, 'SKILL_1'); // Y (Secondary)
      mapButton(5, 'SKILL_2'); // RB (Utility)
      mapButton(4, 'SKILL_4'); // LB (Shield Bash)
      
      mapButton(9, 'MENU');    // Start
      mapButton(8, 'TOGGLE_MAP'); // Back
      
      mapButton(12, 'TOGGLE_INV'); // D-Up
      mapButton(13, 'TOGGLE_CODEX'); // D-Down
      mapButton(14, 'TOGGLE_SKILLS'); // D-Left
      mapButton(15, 'TOGGLE_SHOP'); // D-Right

      requestAnimationFrame(() => this.pollGamepad());
  }
}
