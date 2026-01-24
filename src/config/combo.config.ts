
export type CommandType = 'PRIMARY' | 'SECONDARY' | 'UTILITY' | 'DASH' | 'OVERLOAD' | 'SHIELD_BASH' | 'WHIRLWIND' | 'DASH_STRIKE';

export interface ComboDefinition {
  sequence: CommandType[];
  windowMs: number;
  result: CommandType;
}

export const COMBO_DEFINITIONS: ComboDefinition[] = [
  { sequence: ['PRIMARY', 'SECONDARY', 'DASH'], windowMs: 600, result: 'WHIRLWIND' },
  { sequence: ['DASH', 'PRIMARY', 'PRIMARY'], windowMs: 800, result: 'DASH_STRIKE' }
];
