
import { Injectable, inject } from '@angular/core';
import { Entity } from '../models/game.models';
import { ObjectPool } from '../utils/object-pool';
import { IdGeneratorService } from '../utils/id-generator.service';

const baseEntity: Omit<Entity, 'id' | 'type' | 'x' | 'y'> = {
    z: 0, vx: 0, vy: 0, angle: 0, radius: 20, hp: 1, maxHp: 1, armor: 0,
    color: '#fff', state: 'IDLE', animFrame: 0, animFrameTimer: 0, timer: 0, speed: 0, hitFlash: 0, xpValue: 0,
    status: { stun: 0, slow: 0, poison: null, burn: null, weakness: null, bleed: null },
    hitStopFrames: 0, isHitStunned: false
};

@Injectable({
  providedIn: 'root'
})
export class EntityPoolService {
  private idGenerator = inject(IdGeneratorService);
  private pools = new Map<string, ObjectPool<Entity>>();

  private getPool(type: Entity['type'], subType?: Entity['subType']): ObjectPool<Entity> {
    const key = subType ? `${type}_${subType}` : type;
    if (!this.pools.has(key)) {
      this.pools.set(key, new ObjectPool<Entity>(
        () => ({ ...baseEntity, id: -1, type, subType, x: 0, y: 0, status: { ...baseEntity.status } }),
        (e) => {
          const originalType = e.type;
          const originalSubType = e.subType;
          Object.assign(e, baseEntity);
          e.id = -1;
          e.type = originalType;
          e.subType = originalSubType;
          e.x = 0;
          e.y = 0;
          e.status = { ...baseEntity.status };
          e.trail = undefined;
          e.itemData = undefined;
          e.psionicEffect = undefined;
          e.animPhase = undefined;
          e.knockbackForce = undefined;
          e.attackTimer = undefined;
          e.width = undefined;
          e.height = undefined;
          e.source = undefined;
          e.rotation = undefined;
          e.text = undefined;
          e.name = undefined;
          e.hitStopFrames = 0;
          e.isHitStunned = false;
          e.resistances = undefined;
          e.equipment = undefined;
          e.squadId = undefined;
          e.aiRole = undefined;
          e.zoneId = undefined; // CRITICAL FIX: Reset zoneId to prevent rendering culling issues
        },
        100 
      ));
    }
    return this.pools.get(key)!;
  }

  acquire(type: Entity['type'], subType?: Entity['subType']): Entity {
    const entity = this.getPool(type, subType).acquire();
    entity.id = this.idGenerator.generateNumericId();
    return entity;
  }

  release(entity: Entity): void {
    if (entity.type !== 'WALL' && entity.type !== 'PLAYER') {
        this.getPool(entity.type, entity.subType).release(entity);
    }
  }
}
