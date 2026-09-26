import { context2d, tintSprite } from './util';

interface GlowShape {
  readonly path: string;
  readonly blur: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Source: glow_mask.reference.svg. The box is the path bounds plus three blur deviations. */
const GLOW_SHAPES: readonly GlowShape[] = [
  {
    path: 'M984 371.5C984 438.603 929.603 493 862.5 493L757.001 493C737.446 518.534 706.646 535 672 535L530 535C482.421 535 442.096 503.945 428.187 461L333 461C287.16 461 250 423.84 250 378C250 332.16 287.16 295 333 295L436 295C461.803 295 484.856 306.774 500.079 325.242C509.574 322.482 519.614 321 530 321L594.963 321C614.133 279.107 656.416 250 705.5 250L862.5 250C929.603 250 984 304.397 984 371.5Z',
    blur: 125,
    x: -125,
    y: -125,
    width: 1484,
    height: 1035,
  },
  {
    path: 'M937.763 365.306C931.06 403.1 894.988 428.304 857.194 421.601L593.312 374.801C580.83 372.587 569.723 367.169 560.684 359.545C536.389 372.614 507.684 377.898 478.412 372.707L363.21 352.276C294.148 340.027 248.091 274.111 260.339 205.049C272.588 135.987 338.503 89.9301 407.565 102.178L522.768 122.61C581.653 133.053 623.814 182.513 627.368 239.672L881.467 284.737C919.261 291.44 944.466 327.512 937.763 365.306Z',
    blur: 50,
    x: 98.091,
    y: -60.0699,
    width: 996.375,
    height: 638.3739,
  },
];

/** The width in pixels of each built-in glitter sprite. */
export const GLOW_SPRITE_WIDTH = 128;

function paintGlow(canvas: HTMLCanvasElement, shape: GlowShape, color: string): void {
  const context = context2d(canvas);
  const scale = canvas.width / shape.width;
  const blur = 2 * shape.blur * scale;
  const offset = canvas.width + canvas.height + 4 * blur;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(scale, 0, 0, scale, -shape.x * scale - offset, -shape.y * scale);
  context.shadowColor = '#ffffff';
  context.shadowBlur = blur;
  context.shadowOffsetX = offset;
  context.shadowOffsetY = 0;
  context.fillStyle = '#ffffff';
  context.fill(new Path2D(shape.path));
  context.restore();
  tintSprite(canvas, color);
}

/**
 * Draws the two built-in glitter sprites in one color.
 *
 * @param createCanvas - The function that makes an offscreen canvas.
 * @param color - The CSS color of the sprites.
 * @returns Two sprites. Each sprite keeps the aspect ratio of its shape.
 */
export function createGlowSprites(
  createCanvas: (width: number, height: number) => HTMLCanvasElement,
  color: string,
): HTMLCanvasElement[] {
  return GLOW_SHAPES.map((shape) => {
    const height = Math.round((GLOW_SPRITE_WIDTH * shape.height) / shape.width);
    const canvas = createCanvas(GLOW_SPRITE_WIDTH, height);
    paintGlow(canvas, shape, color);
    return canvas;
  });
}

/**
 * Draws the built-in glitter sprites again in a different color.
 *
 * @param sprites - The sprites from {@link createGlowSprites}.
 * @param color - The new CSS color.
 */
export function repaintGlowSprites(sprites: readonly HTMLCanvasElement[], color: string): void {
  sprites.forEach((canvas, index) => {
    const shape = GLOW_SHAPES[index];
    if (shape) paintGlow(canvas, shape, color);
  });
}
