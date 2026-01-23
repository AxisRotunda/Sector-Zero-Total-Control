
export type FloatingTextPayload = { 
  text: string; 
  x?: number; 
  y?: number; 
  color: string; 
  size: number; 
  onPlayer?: boolean; 
  yOffset?: number; 
};

export type ScreenShakePayload = { 
  intensity: number; 
  decay: number; 
  x?: number; 
  y?: number; 
};

export type LocationDiscoveryPayload = {
  zoneId: string;
  name: string;
  description: string;
};

export type EnemyKillPayload = { type: string };
export type ItemCollectPayload = { itemId: string };

export type GameEvent =
  | { type: 'FLOATING_TEXT_SPAWN'; payload: FloatingTextPayload }
  | { type: 'PLAYER_DEATH'; payload?: void }
  | { type: 'PLAYER_LEVEL_UP'; payload?: void }
  | { type: 'ADD_SCREEN_SHAKE'; payload: ScreenShakePayload }
  | { type: 'LOCATION_DISCOVERED'; payload: LocationDiscoveryPayload }
  | { type: 'ENEMY_KILLED'; payload: EnemyKillPayload }
  | { type: 'ITEM_COLLECTED'; payload: ItemCollectPayload };

export const GameEvents = {
  FLOATING_TEXT_SPAWN: 'FLOATING_TEXT_SPAWN' as const,
  PLAYER_DEATH: 'PLAYER_DEATH' as const,
  PLAYER_LEVEL_UP: 'PLAYER_LEVEL_UP' as const,
  ADD_SCREEN_SHAKE: 'ADD_SCREEN_SHAKE' as const,
  LOCATION_DISCOVERED: 'LOCATION_DISCOVERED' as const,
  ENEMY_KILLED: 'ENEMY_KILLED' as const,
  ITEM_COLLECTED: 'ITEM_COLLECTED' as const,
};
