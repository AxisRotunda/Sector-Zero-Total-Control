
import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { NarrativeService } from '../game/narrative.service';
import { PlayerProgressionService } from '../game/player/player-progression.service';
import { PlayerStatsService } from '../game/player/player-stats.service';
import { MissionService } from '../game/mission.service';
import { SoundService } from './sound.service';
import { DialogueNode, DialogueOption, DialogueAction, Requirement, Faction } from '../models/narrative.models';
import { DIALOGUES } from '../config/narrative.config';
import { EventBusService } from '../core/events/event-bus.service';
import { GameEvents } from '../core/events/game-events';
import { InventoryService } from '../game/inventory.service';
import { ItemGeneratorService } from './item-generator.service';
import { ProofKernelService } from '../core/proof/proof-kernel.service';

@Injectable({ providedIn: 'root' })
export class DialogueService implements OnDestroy {
  private narrative = inject(NarrativeService);
  private progression = inject(PlayerProgressionService);
  private stats = inject(PlayerStatsService);
  private mission = inject(MissionService);
  private sound = inject(SoundService);
  private eventBus = inject(EventBusService);
  private inventory = inject(InventoryService);
  private itemGen = inject(ItemGeneratorService);
  private proofKernel = inject(ProofKernelService);

  activeDialogue = signal<DialogueNode | null>(null);
  visibleText = signal('');
  isTyping = signal(false);

  private fullText = '';
  private typeInterval: any;
  private typeIndex = 0;
  private typeSpeed = 20; // ms per char

  ngOnDestroy() {
    this.close();
  }

  startDialogue(id: string) {
      const node = DIALOGUES[id];
      if (!node) {
          // If ID missing, log bleed and close
          this.eventBus.dispatch({ type: GameEvents.REALITY_BLEED, payload: { severity: 'LOW', source: 'Dialogue', message: `Missing Node: ${id}` }});
          this.close();
          return;
      }
      
      // --- VERIFICATION STEP ---
      const proof = this.proofKernel.verifyDialogueState(node, (reqs) => this.checkRequirements(reqs));
      if (!proof.isValid) {
          this.eventBus.dispatch({
              type: GameEvents.REALITY_BLEED,
              payload: { severity: 'MEDIUM', source: 'DialogueCheck', message: proof.errors[0] }
          });
          
          // Glitch fallback: Override mood to show corruption
          node.mood = 'GLITCHED';
          node.text = '...[DATA CORRUPTED]... [AXIOM FAILURE]...';
      }

      this.activeDialogue.set(node);
      this.fullText = node.text;
      this.visibleText.set('');
      this.typeIndex = 0;
      this.isTyping.set(true);
      
      this.startTypewriter();
  }

  skipTypewriter() {
      if (this.isTyping()) {
          clearInterval(this.typeInterval);
          this.visibleText.set(this.fullText);
          this.isTyping.set(false);
      }
  }

  selectOption(option: DialogueOption) {
      if (this.isTyping()) {
          this.skipTypewriter();
          return;
      }

      if (!this.checkRequirements(option.reqs)) {
          this.sound.play('UI'); // Error sound ideally
          return;
      }

      if (option.actions) {
          this.executeActions(option.actions);
      }

      this.sound.play('UI');
      
      if (option.nextId) {
          this.startDialogue(option.nextId);
      } else {
          this.close();
      }
  }

  close() {
      this.activeDialogue.set(null);
      this.visibleText.set('');
      this.isTyping.set(false);
      if (this.typeInterval) {
          clearInterval(this.typeInterval);
          this.typeInterval = null;
      }
  }

  // --- INTERNAL LOGIC ---

  private startTypewriter() {
      if (this.typeInterval) clearInterval(this.typeInterval);
      
      this.typeInterval = setInterval(() => {
          if (this.typeIndex < this.fullText.length) {
              const char = this.fullText[this.typeIndex];
              this.visibleText.update(t => t + char);
              this.typeIndex++;
          } else {
              this.isTyping.set(false);
              clearInterval(this.typeInterval);
              this.typeInterval = null;
          }
      }, this.typeSpeed);
  }

  checkRequirements(reqs?: Requirement[]): boolean {
      if (!reqs || reqs.length === 0) return true;

      return reqs.every(req => {
          let met = false;
          switch (req.type) {
              case 'CREDITS':
                  met = this.progression.credits() >= (req.value as number);
                  break;
              case 'STAT':
                  const stats = this.stats.playerStats();
                  const statVal = (stats as any)[req.target] || 0;
                  met = statVal >= (req.value as number);
                  break;
              case 'REP':
                  const rep = this.narrative.getReputation(req.target as Faction['id']);
                  met = rep >= (req.value as number);
                  break;
              case 'FLAG':
                  const flag = this.narrative.getFlag(req.target);
                  met = flag === req.value;
                  break;
              default:
                  met = true;
          }
          return req.invert ? !met : met;
      });
  }

  private executeActions(actions: DialogueAction[]) {
      actions.forEach(act => {
          switch (act.type) {
              case 'ADD_CREDITS':
                  this.progression.gainCredits(act.value as number);
                  break;
              case 'HEAL':
                  this.stats.playerHp.set(this.stats.playerStats().hpMax);
                  break;
              case 'SET_FLAG':
                  this.narrative.setFlag(act.target!, act.value as boolean);
                  break;
              case 'ADD_REP':
                  this.narrative.modifyReputation(act.target as Faction['id'], act.value as number);
                  break;
              case 'START_MISSION':
                  this.mission.startQuest(act.target!);
                  break;
              case 'COMPLETE_MISSION':
                  this.mission.completeQuest(act.target!);
                  break;
              case 'UNLOCK_LORE':
                  if (this.narrative.discoverLog(act.target!)) {
                      this.eventBus.dispatch({ 
                          type: GameEvents.FLOATING_TEXT_SPAWN, 
                          payload: { onPlayer: true, yOffset: -120, text: "DATA LOG ACQUIRED", color: '#fbbf24', size: 24 } 
                      });
                  }
                  break;
              case 'GIVE_ITEM':
                  // Special handling for test items in simulation
                  if (act.target && act.target.startsWith('TEST_')) {
                      const weaponType = act.target.replace('TEST_', '');
                      const item = this.itemGen.generateTestWeapon(weaponType);
                      if (this.inventory.addItem(item)) {
                          this.eventBus.dispatch({
                              type: GameEvents.FLOATING_TEXT_SPAWN,
                              payload: { onPlayer: true, yOffset: -60, text: `ITEM ACQUIRED: ${item.name}`, color: '#22c55e', size: 20 }
                          });
                      }
                  }
                  break;
              case 'REMOVE_ITEM':
                  // Not fully implemented yet, but placeholder
                  break;
          }
      });
  }
}
