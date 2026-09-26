const NOISE_SIZE = 512;

/**
 * Keeps a set of reusable objects. The first `count` items are alive.
 *
 * @example
 * const pool = new Pool(() => ({ x: 0 }));
 * pool.acquire().x = 10;
 */
export class Pool<T> {
  readonly items: T[] = [];
  count = 0;
  private readonly create: () => T;

  constructor(create: () => T) {
    this.create = create;
  }

  /** Gets an unused object and marks it alive. */
  acquire(): T {
    let item = this.items[this.count];
    if (item === undefined) {
      item = this.create();
      this.items.push(item);
    }
    this.count++;
    return item;
  }

  /**
   * Moves the alive item at `from` to the slot `to` and moves the old item of `to` to `from`.
   *
   * @param from - The index of an item to keep.
   * @param to - The next free slot of the compacted range.
   */
  move(from: number, to: number): void {
    if (from === to) return;
    const kept = this.items[from] as T;
    this.items[from] = this.items[to] as T;
    this.items[to] = kept;
  }

  /** Marks all objects unused. */
  clear(): void {
    this.count = 0;
  }
}

/** The red, green and blue channels of a color, from 0 to 255. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** The width and the height of an image. */
export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Makes a one-dimensional value noise function with a table that the random function fills.
 *
 * @param random - The source of random values in the range from 0 to 1.
 * @returns A function that gives a smooth value from 0 to 1 for each position.
 * @example
 * const noise = createNoise(Math.random);
 * const wobble = noise(12.5) - 0.5;
 */
export function createNoise(random: () => number): (x: number) => number {
  const values = new Float32Array(NOISE_SIZE);
  for (let i = 0; i < NOISE_SIZE; i++) values[i] = random();
  return (x) => {
    const xi = Math.floor(x);
    const xf = x - xi;
    const index = ((xi % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE;
    const r1 = values[index] ?? 0;
    const r2 = values[(index + 1) % NOISE_SIZE] ?? 0;
    const u = xf * xf * (3 - 2 * xf);
    return r1 + u * (r2 - r1);
  };
}

/**
 * Applies the circular ease in and out curve to a value from 0 to 1.
 *
 * @param x - The progress, from 0 to 1.
 * @returns The eased progress, from 0 to 1.
 */
export function easeInOutCirc(x: number): number {
  return x < 0.5
    ? (1 - Math.sqrt(1 - (2 * x) ** 2)) / 2
    : (Math.sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2;
}

/**
 * Converts a `#rrggbb` color to its channels. A color that is not valid gives white.
 *
 * @param hex - The color in the format `#rrggbb` or `rrggbb`.
 * @returns The red, green and blue channels.
 */
export function hexToRgb(hex: string): Rgb {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return { r: 255, g: 255, b: 255 };
  return {
    r: Number.parseInt(match[1] ?? 'ff', 16),
    g: Number.parseInt(match[2] ?? 'ff', 16),
    b: Number.parseInt(match[3] ?? 'ff', 16),
  };
}

/**
 * Gets the 2D context of a canvas. If the canvas has no 2D context, the function throws an error.
 *
 * @param canvas - The canvas.
 * @returns The 2D context.
 */
export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The canvas has no 2D context.');
  return context;
}

/**
 * Fills the pixels of a sprite with one color and keeps the alpha of each pixel.
 *
 * @param canvas - The sprite to tint.
 * @param color - The CSS color.
 */
export function tintSprite(canvas: HTMLCanvasElement, color: string): void {
  const context = context2d(canvas);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

/**
 * Draws a radial gradient of one color on a square sprite.
 *
 * @param canvas - The square sprite.
 * @param rgb - The color.
 * @param stops - Pairs of offset and alpha, from the center to the edge.
 */
export function paintRadialSprite(
  canvas: HTMLCanvasElement,
  rgb: Rgb,
  stops: readonly (readonly [offset: number, alpha: number])[],
): void {
  const context = context2d(canvas);
  const half = canvas.width / 2;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  for (const [offset, alpha] of stops) {
    gradient.addColorStop(offset, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function numberProperty(source: object, key: string): number {
  const value = (source as Record<string, unknown>)[key];
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'baseVal' in value) {
    const base = (value as { baseVal: { value?: unknown } }).baseVal.value;
    if (typeof base === 'number') return base;
  }
  return 0;
}

/**
 * Finds the intrinsic size of an image source. An unknown size gives a square of 1 by 1.
 *
 * @param source - The image source.
 * @returns The width and the height.
 */
export function imageSize(source: CanvasImageSource): ImageSize {
  const width =
    numberProperty(source, 'naturalWidth') ||
    numberProperty(source, 'videoWidth') ||
    numberProperty(source, 'displayWidth') ||
    numberProperty(source, 'width');
  const height =
    numberProperty(source, 'naturalHeight') ||
    numberProperty(source, 'videoHeight') ||
    numberProperty(source, 'displayHeight') ||
    numberProperty(source, 'height');
  return width > 0 && height > 0 ? { width, height } : { width: 1, height: 1 };
}
