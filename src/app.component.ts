import { Component, ElementRef, OnInit, ViewChild, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from './game/game-engine.service';
import { MissionService } from './game/mission.service';
import { InputService, Action } from './services/input.service';
import { RenderService } from './systems/render.service';
import { PersistenceService } from './core/persistence.service';
import { PlayerService } from './game/player/player.service';
import { WorldService } from './game/world/world.service';
import { HudComponent } from './components/hud.component';
import { InventoryComponent } from './components/inventory.component';
import { SkillTreeComponent } from './components/skill-tree.component';
import { JoystickComponent } from './components/joystick.component';
import { ItemTooltipComponent } from './components/item-tooltip.component';
import { ShopComponent } from './components/shop.component';
import { ShopService } from './services/shop.service';
import { MapComponent } from './components/map.component';
import { MapService } from './services/map.service';
import { SettingsComponent } from './components/settings.component';
import { AbilitiesPanelComponent } from './components/abilities-panel.component';
import { DialogueOverlayComponent } from './components/dialogue-overlay.component';
import { CodexComponent } from './components/codex.component';
import { MissionJournalComponent } from './components/mission-journal.component';
import { PlayerControlService } from './systems/player-control.service';
import { DialogueService } from './services/dialogue.service';
import { Subscription } from 'rxjs';
import { HapticService } from './services/haptic.service';
import { UiPanelService } from './services/ui-panel.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HudComponent, InventoryComponent, SkillTreeComponent, JoystickComponent, ItemTooltipComponent, ShopComponent, MapComponent, SettingsComponent, AbilitiesPanelComponent, DialogueOverlayComponent, CodexComponent, MissionJournalComponent],
  templateUrl: './app.component.html',
  host: {
    '(contextmenu)': 'onRightClick($event)',
  }
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  game = inject(GameEngineService);
  mission = inject(MissionService);
  input = inject(InputService);
  renderer = inject(RenderService);
  persistence = inject(PersistenceService);
  player = inject(PlayerService);
  world = inject(WorldService);
  shop = inject(ShopService);
  mapService = inject(MapService);
  playerControl = inject(PlayerControlService);
  dialogueService = inject(DialogueService);
  haptic = inject(HapticService);
  ui = inject(UiPanelService);

  private lastTapTime = 0;
  private readonly DOUBLE_TAP_THRESHOLD = 300; 
  private sub!: Subscription;

  ngOnInit() {
    this.game.init(this.canvasRef.nativeElement);
    this.sub = this.input.actionEvents.subscribe((action: Action) => {
        this.handleAction(action);
    });
  }
  
  ngOnDestroy() {
    // Only stop the game loop, keep redundant services alive for potential restart
    this.game.destroy();
    this.renderer.destroy();
    if (this.sub) this.sub.unsubscribe();
  }

  handleAction(action: Action) {
      if (this.game.isInMenu()) return;

      switch(action) {
          case 'TOGGLE_INV': this.ui.openPanel('INVENTORY'); break;
          case 'TOGGLE_SKILLS': this.ui.openPanel('SKILLS'); break;
          case 'TOGGLE_CODEX': this.ui.openPanel('CODEX'); break;
          case 'TOGGLE_MAP': this.mapService.toggleFullMap(); break;
          case 'TOGGLE_PSI': this.ui.openPanel('ABILITIES'); break;
          case 'TOGGLE_SHOP': if (this.ui.isOpen('SHOP')) this.ui.closeAll(); break;
          case 'MENU': 
               if (this.ui.isOpen('INVENTORY') || this.ui.isOpen('SKILLS') || this.ui.isOpen('SHOP') || this.ui.isOpen('ABILITIES') || this.ui.isOpen('CODEX') || this.ui.isOpen('JOURNAL')) {
                   this.ui.closeAll();
               }
               else if (this.mapService.isFullMapOpen()) this.mapService.toggleFullMap();
               else if (this.mapService.isSettingsOpen()) this.mapService.toggleSettings();
               else this.mapService.toggleSettings();
               break;
          case 'INTERACT':
               const target = this.playerControl.nearbyInteractable();
               if (target) {
                   this.haptic.impactLight();
                   this.dialogueService.startDialogue(target.dialogueId || 'generic');
               }
               break;
      }
  }

  loadGame() {
      this.haptic.success();
      this.game.startGame(false);
  }
  newGame() {
      this.haptic.success();
      this.game.startGame(true);
  }
  resetGame() {
      if(confirm('Wipe all save data? This cannot be undone.')) {
          this.haptic.error();
          this.persistence.resetGame();
      }
  }

  useSkill(skill: 'PRIMARY' | 'SECONDARY' | 'DASH' | 'UTILITY' | 'OVERLOAD' | 'SHIELD_BASH', e: Event) {
      e.preventDefault(); e.stopPropagation();
      this.haptic.impactLight();
      this.player.abilities.useSkill(skill as any);
  }

  startAttack(e: Event) {
      e.preventDefault(); e.stopPropagation();
      this.input.setAttackState(true);
  }

  stopAttack(e: Event) {
      e.preventDefault(); e.stopPropagation();
      this.input.setAttackState(false);
  }

  toggleAutoCombat() {
      this.haptic.impactLight();
      this.player.toggleAutoCombat();
  }

  onJoystickMove(vec: {x: number, y: number}) {
      this.input.setJoystick(vec.x, vec.y);
  }

  handleGlobalTouch(event: TouchEvent) {
    if (this.game.isInMenu() || this.ui.isOpen('SKILLS') || this.ui.isOpen('SHOP') || this.mapService.isFullMapOpen() || this.mapService.isSettingsOpen() || this.ui.isOpen('ABILITIES') || this.ui.isOpen('CODEX') || this.ui.isOpen('JOURNAL')) return;
    
    if (this.ui.isOpen('INVENTORY') && (event.target as HTMLElement).closest('.app-inventory-container')) return;

    const target = event.target as HTMLElement;
    if (target.closest('app-joystick') || target.closest('button')) {
        return;
    }
    
    if (event.changedTouches[0].clientX > window.innerWidth / 2) {
        const currentTime = Date.now();
        if (currentTime - this.lastTapTime < this.DOUBLE_TAP_THRESHOLD) {
            event.preventDefault();
            this.haptic.impactMedium();
            this.player.abilities.useSkill('DASH', this.input.aimAngle ?? undefined);
            this.lastTapTime = 0; 
        } else {
            this.lastTapTime = currentTime;
        }
    }
  }

  onRightClick(event: MouseEvent) {
      event.preventDefault();
      if (!this.game.isInMenu()) {
          this.player.abilities.useSkill('DASH', this.input.aimAngle ?? undefined);
      }
  }
}