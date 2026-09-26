import { field } from '../config/field';
import type { ColorField, NumberField } from '../config/types';
import type { Effect, EffectConfig, EffectContext, Frame, WandEvents } from '../core/types';
import { createGlowSprites, repaintGlowSprites } from './glow-mask';
import { imageSize, Pool } from './util';

const MIN_VISIBLE_ALPHA = 0.01;
const TWO_PI = Math.PI * 2;

/** The configuration fields of the glitter effect. */
export type GlitterSchema = {
  readonly size: NumberField;
  readonly spawnRate: NumberField;
  readonly gravity: NumberField;
  readonly friction: NumberField;
  readonly fadeRate: NumberField;
  readonly twinkle: NumberField;
  readonly color: ColorField<true>;
  readonly maxParticles: NumberField;
};

/** The schema of the glitter effect. The defaults are the values of the demo. */
export const glitterSchema: GlitterSchema = {
  size: field.number({
    label: 'Glitter size',
    description: 'The base size of a glitter particle in pixels.',
    default: 10,
    min: 1,
    max: 50,
    step: 1,
  }),
  spawnRate: field.number({
    label: 'Glitter density',
    description: 'The minimum number of particles for each burst.',
    default: 4,
    min: 1,
    max: 20,
    step: 1,
  }),
  gravity: field.number({
    label: 'Gravity',
    description: 'The downward pull on each particle. A negative value lifts the particles.',
    default: 0.02,
    min: -0.1,
    max: 0.2,
    step: 0.01,
  }),
  friction: field.number({
    label: 'Friction',
    description: 'The part of the speed that a particle keeps in each frame.',
    default: 0.98,
    min: 0.8,
    max: 1,
    step: 0.01,
  }),
  fadeRate: field.number({
    label: 'Glitter fade speed',
    description: 'The speed at which a particle disappears.',
    default: 0.015,
    min: 0.001,
    max: 0.05,
    step: 0.001,
  }),
  twinkle: field.number({
    label: 'Twinkle intensity',
    description: 'The sharpness of the twinkle. A high value gives short flashes.',
    default: 6,
    min: 1,
    max: 20,
    step: 1,
  }),
  color: field.color({
    label: 'Glitter color',
    description: 'The color of the glitter. The value null uses the theme color.',
    default: null,
    nullable: true,
  }),
  maxParticles: field.number({
    label: 'Maximum particles',
    description: 'The maximum number of glitter particles on the screen.',
    default: 2000,
    min: 1,
    max: 5000,
    step: 1,
  }),
};

/** The options of the glitter effect. */
export interface GlitterOptions {
  /** An image that replaces the built-in sprites. The effect draws it without a tint. */
  readonly sprite?: CanvasImageSource;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  twinklePhase: number;
  twinkleSpeed: number;
  rotation: number;
  rotationSpeed: number;
  sprite: number;
}

interface SpriteImage {
  readonly image: CanvasImageSource;
  readonly aspect: number;
}

function createParticle(): Particle {
  return {
    x: 0,
    y: 0,
    size: 0,
    vx: 0,
    vy: 0,
    life: 0,
    decay: 0,
    twinklePhase: 0,
    twinkleSpeed: 0,
    rotation: 0,
    rotationSpeed: 0,
    sprite: 0,
  };
}

function spriteImage(image: CanvasImageSource): SpriteImage {
  const { width, height } = imageSize(image);
  return { image, aspect: height / width };
}

/**
 * Creates the glitter effect. Particles twinkle, turn and fall at each `burst` event.
 *
 * @param options - The options. `sprite` replaces the built-in sprites.
 * @returns The glitter effect for `createWand`.
 * @example
 * createWand({ effects: [chalkEffect(), glitterEffect()] });
 */
export function glitterEffect(
  options: GlitterOptions = {},
): Effect<'glitter', typeof glitterSchema> {
  const particles = new Pool(createParticle);
  const customSprite = options.sprite ? spriteImage(options.sprite) : undefined;
  let context: EffectContext | undefined;
  let config: EffectConfig<GlitterSchema> | undefined;
  let sprites: SpriteImage[] = customSprite ? [customSprite] : [];
  let glowCanvases: HTMLCanvasElement[] | undefined;
  let spriteColor: string | undefined;
  let reducedMotion = false;
  let unsubscribe: (() => void) | undefined;

  function spawn(burst: WandEvents['burst']): void {
    if (!config || !context || reducedMotion) return;
    const base = Math.floor(config.spawnRate * burst.strength);
    let count = Math.floor(context.random() * (base * 0.5)) + base;
    count = Math.min(count, config.maxParticles - particles.count);
    const size = config.size;
    const fadeRate = config.fadeRate;
    const spriteCount = customSprite ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const particle = particles.acquire();
      particle.x = burst.x;
      particle.y = burst.y;
      particle.size = context.random() * size + size * 0.3;
      particle.vx = (context.random() - 0.5) * 4;
      particle.vy = (context.random() - 0.5) * 4 - 1;
      particle.life = 1;
      particle.decay = context.random() * (fadeRate * 0.5) + fadeRate * 0.5;
      particle.twinklePhase = context.random() * TWO_PI;
      particle.twinkleSpeed = context.random() * 0.2 + 0.05;
      particle.rotation = context.random() * TWO_PI;
      particle.rotationSpeed = (context.random() - 0.5) * 0.05;
      particle.sprite = Math.floor(context.random() * spriteCount);
    }
  }

  function prepareSprites(color: string): readonly SpriteImage[] {
    const source = context;
    if (customSprite || !source) return sprites;
    if (!glowCanvases) {
      glowCanvases = createGlowSprites(
        (width, height) => source.createCanvas(width, height),
        color,
      );
      sprites = glowCanvases.map(spriteImage);
    } else if (spriteColor !== color) {
      repaintGlowSprites(glowCanvases, color);
    }
    spriteColor = color;
    return sprites;
  }

  return {
    name: 'glitter',
    schema: glitterSchema,
    layer: 20,
    composite: 'lighter',
    setup(effectContext) {
      context = effectContext;
      unsubscribe?.();
      unsubscribe = effectContext.bus.on('burst', spawn);
    },
    configure(next) {
      config = next;
    },
    update(frame: Frame) {
      reducedMotion = frame.reducedMotion;
      if (!config) return;
      if (reducedMotion) {
        particles.clear();
        return;
      }
      const dt = frame.dt;
      const gravity = config.gravity * dt;
      const friction = config.friction ** dt;
      let alive = 0;
      for (let i = 0; i < particles.count; i++) {
        const particle = particles.items[i] as Particle;
        particle.vy += gravity;
        particle.vx *= friction;
        particle.vy *= friction;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= particle.decay * dt;
        particle.twinklePhase += particle.twinkleSpeed * dt;
        particle.rotation += particle.rotationSpeed * dt;
        if (particle.life > 0) particles.move(i, alive++);
      }
      particles.count = alive;
    },
    draw(canvas: CanvasRenderingContext2D) {
      if (!config || particles.count === 0) return;
      const images = prepareSprites(config.color);
      if (images.length === 0) return;
      const base = canvas.getTransform();
      const { a, b, c, d, e, f } = base;
      const power = config.twinkle;
      for (let i = 0; i < particles.count; i++) {
        const particle = particles.items[i] as Particle;
        const alpha = particle.life * Math.abs(Math.sin(particle.twinklePhase)) ** power;
        if (alpha < MIN_VISIBLE_ALPHA) continue;
        const sprite = images[particle.sprite] ?? images[0];
        if (!sprite) continue;
        const cos = Math.cos(particle.rotation);
        const sin = Math.sin(particle.rotation);
        const { x, y } = particle;
        canvas.globalAlpha = alpha;
        canvas.setTransform(
          a * cos + c * sin,
          b * cos + d * sin,
          c * cos - a * sin,
          d * cos - b * sin,
          a * x + c * y + e,
          b * x + d * y + f,
        );
        const width = particle.size;
        const height = width * sprite.aspect;
        canvas.drawImage(sprite.image, -width / 2, -height / 2, width, height);
      }
      canvas.setTransform(base);
    },
    isIdle() {
      return particles.count === 0;
    },
    clear() {
      particles.clear();
    },
    destroy() {
      unsubscribe?.();
      unsubscribe = undefined;
      particles.clear();
      particles.items.length = 0;
      glowCanvases = undefined;
      sprites = customSprite ? [customSprite] : [];
      spriteColor = undefined;
      context = undefined;
    },
  };
}
