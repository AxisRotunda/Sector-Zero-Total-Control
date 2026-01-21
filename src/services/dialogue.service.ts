import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { NarrativeService } from '../game/narrative.service';
import { PlayerService } from '../game/player/player.service';
import { MissionService } from '../game/mission.service';
import { SoundService } from './sound.service';
import { DialogueNode, DialogueOption, DialogueAction, Requirement, Faction } from '../models/narrative.models';
import { DIALOGUES } from '../config/narrative.config';

@Injectable({ providedIn: 'root' })
export class DialogueService implements OnDestroy {
  private narrative = inject(NarrativeService);
  private player = inject(PlayerService);
  private mission = inject(MissionService);
  private sound = inject(SoundService);

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
          this.close();
          return;
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
                  met = this.player.progression.credits() >= (req.value as number);
                  break;
              case 'STAT':
                  const stats = this.player.stats.playerStats();
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
                  this.player.progression.gainCredits(act.value as number);
                  break;
              case 'HEAL':
                  this.player.stats.playerHp.set(this.player.stats.playerStats().hpMax);
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
          }
      });
  }
}