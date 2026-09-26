import { field } from '../config/field';
import type { ColorField, NumberField } from '../config/types';
import type { Effect, EffectConfig, EffectContext, Frame, WandPointerEvent } from '../core/types';
import { createNoise, hexToRgb, Pool, paintRadialSprite } from './util';

const SPRITE_SIZE = 128;
const PEAK_ALPHA = 0.1;
const MIN_VISIBLE_ALPHA = 0.002;
const CLOUD_GRADIENT: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.5, 0.4],
  [1, 0],
];

/** The configuration fields of the cloud effect. */
export type CloudSchema = {
  readonly size: NumberField;
  readonly density: NumberField;
  readonly bounce: NumberField;
  readonly spread: NumberField;
  readonly fadeRate: NumberField;
  readonly color: ColorField<true>;
  readonly maxClouds: NumberField;
};

/** The schema of the cloud effect. The defaults are the values of the demo. */
export const cloudSchema: CloudSchema = {
  size: field.number({
    label: 'Cloud size',
    description: 'The minimum radius of a new cloud in pixels.',
    default: 18,
    min: 10,
    max: 150,
    step: 1,
  }),
  density: field.number({
    label: 'Cloud density',
    description: 'The chance of a new cloud in each frame while the pointer moves.',
    default: 0.25,
    min: 0.1,
    max: 1,
    step: 0.05,
  }),
  bounce: field.number({
    label: 'Cloud bounce',
    description: 'The range of the noise wobble in pixels. The value 0 stops the wobble.',
    default: 26,
    min: 0,
    max: 150,
    step: 1,
  }),
  spread: field.number({
    label: 'Cloud spread',
    description: 'The size of the area around the pointer where new clouds start.',
    default: 50,
    min: 0,
    max: 200,
    step: 1,
  }),
  fadeRate: field.number({
    label: 'Cloud fade speed',
    description: 'The speed at which a cloud disappears.',
    default: 0.01,
    min: 0.001,
    max: 0.05,
    step: 0.001,
  }),
  color: field.color({
    label: 'Cloud color',
    description: 'The color of the clouds. The value null uses the theme color.',
    default: '#fad30b',
    nullable: true,
  }),
  maxClouds: field.number({
    label: 'Maximum clouds',
    description: 'The maximum number of clouds on the screen.',
    default: 300,
    min: 1,
    max: 1000,
    step: 1,
  }),
};

interface Cloud {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  size: number;
  life: number;
  decay: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
  time: number;
}

function createCloud(): Cloud {
  return {
    baseX: 0,
    baseY: 0,
    x: 0,
    y: 0,
    size: 0,
    life: 0,
    decay: 0,
    noiseOffsetX: 0,
    noiseOffsetY: 0,
    time: 0,
  };
}

function cloudAlpha(life: number): number {
  const fade = life > 0.8 ? (1 - life) / 0.2 : life / 0.8;
  return PEAK_ALPHA * fade;
}

/**
 * Creates the cloud effect. Soft clouds rise and wobble around the pointer while it moves.
 *
 * @returns The cloud effect for `createWand`.
 * @example
 * createWand({ effects: [cloudEffect()] });
 */
export function cloudEffect(): Effect<'cloud', typeof cloudSchema> {
  const clouds = new Pool(createCloud);
  let context: EffectContext | undefined;
  let noise: (x: number) => number = () => 0.5;
  let config: EffectConfig<CloudSchema> | undefined;
  let sprite: HTMLCanvasElement | undefined;
  let spriteColor: string | undefined;
  let pointerActive = false;
  let pointerX = 0;
  let pointerY = 0;

  function spawn(settings: EffectConfig<CloudSchema>, source: EffectContext): void {
    const cloud = clouds.acquire();
    cloud.baseX = pointerX + (source.random() - 0.5) * settings.spread;
    cloud.baseY = pointerY + (source.random() - 0.5) * settings.spread;
    cloud.x = cloud.baseX;
    cloud.y = cloud.baseY;
    cloud.size = source.random() * settings.size + settings.size;
    cloud.life = 1;
    cloud.decay = source.random() * settings.fadeRate + settings.fadeRate * 0.33;
    cloud.noiseOffsetX = source.random() * 1000;
    cloud.noiseOffsetY = source.random() * 1000;
    cloud.time = 0;
  }

  function currentSprite(color: string): HTMLCanvasElement | undefined {
    if (!context) return undefined;
    if (!sprite) sprite = context.createCanvas(SPRITE_SIZE, SPRITE_SIZE);
    if (spriteColor !== color) {
      paintRadialSprite(sprite, hexToRgb(color), CLOUD_GRADIENT);
      spriteColor = color;
    }
    return sprite;
  }

  return {
    name: 'cloud',
    schema: cloudSchema,
    layer: 0,
    composite: 'source-over',
    setup(effectContext) {
      context = effectContext;
      noise = createNoise(() => effectContext.random());
    },
    configure(next) {
      config = next;
    },
    pointer(event: WandPointerEvent) {
      switch (event.phase) {
        case 'down':
        case 'move':
          pointerActive = true;
          pointerX = event.x;
          pointerY = event.y;
          break;
        case 'up':
          if (event.pointerType !== 'mouse') pointerActive = false;
          break;
        case 'cancel':
        case 'leave':
          pointerActive = false;
          break;
        case 'tap':
          break;
      }
    },
    update(frame: Frame) {
      if (!config || !context) return;
      if (frame.reducedMotion) {
        clouds.clear();
        return;
      }
      const dt = frame.dt;
      if (pointerActive && clouds.count < config.maxClouds) {
        const chance = 1 - (1 - config.density) ** dt;
        if (context.random() < chance) spawn(config, context);
      }
      const bounce = config.bounce;
      let alive = 0;
      for (let i = 0; i < clouds.count; i++) {
        const cloud = clouds.items[i] as Cloud;
        cloud.life -= cloud.decay * dt;
        cloud.time += 0.02 * dt;
        cloud.baseY -= 0.4 * dt;
        cloud.x = cloud.baseX + (noise(cloud.noiseOffsetX + cloud.time) - 0.5) * bounce;
        cloud.y = cloud.baseY + (noise(cloud.noiseOffsetY + cloud.time) - 0.5) * bounce;
        cloud.size += 0.3 * dt;
        if (cloud.life > 0) clouds.move(i, alive++);
      }
      clouds.count = alive;
    },
    draw(canvas: CanvasRenderingContext2D) {
      if (!config || clouds.count === 0) return;
      const image = currentSprite(config.color);
      if (!image) return;
      for (let i = 0; i < clouds.count; i++) {
        const cloud = clouds.items[i] as Cloud;
        const alpha = cloudAlpha(cloud.life);
        if (alpha < MIN_VISIBLE_ALPHA) continue;
        canvas.globalAlpha = alpha;
        const radius = cloud.size;
        canvas.drawImage(image, cloud.x - radius, cloud.y - radius, radius * 2, radius * 2);
      }
    },
    isIdle() {
      return clouds.count === 0;
    },
    clear() {
      clouds.clear();
    },
    destroy() {
      clouds.clear();
      clouds.items.length = 0;
      pointerActive = false;
      sprite = undefined;
      spriteColor = undefined;
      context = undefined;
    },
  };
}
