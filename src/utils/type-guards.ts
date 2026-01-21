import { Entity } from '../models/game.models';

export function isEnemy(e: Entity): boolean {
    return e.type === 'ENEMY';
}

export function isDestructible(e: Entity): boolean {
    return e.type === 'DESTRUCTIBLE';
}