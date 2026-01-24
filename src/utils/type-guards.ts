
import { Entity, Particle } from '../models/game.models';

export function isEnemy(e: Entity): boolean {
    return e.type === 'ENEMY';
}

export function isDestructible(e: Entity): boolean {
    return e.type === 'DESTRUCTIBLE';
}

export function isParticle(obj: Entity | Particle): obj is Particle {
    return 'life' in obj && 'sizeStart' in obj;
}
