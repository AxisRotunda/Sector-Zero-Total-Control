
export enum DepthLayer {
  GROUND = 0,
  FLOOR_DECORATION = 100,
  SHADOWS = 200,
  STRUCTURES = 300,
  ITEMS = 400,
  UNITS = 500,
  FX_LOW = 600,
  FX_HIGH = 700,
  UI_WORLD = 1000
}

export interface SpriteDefinition {
  id: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  canvas: OffscreenCanvas | HTMLCanvasElement;
}
