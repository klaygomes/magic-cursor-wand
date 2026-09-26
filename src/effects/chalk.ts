import { field } from '../config/field';
import type { ColorField, NumberField } from '../config/types';
import type {
  Effect,
  EffectConfig,
  EffectContext,
  Frame,
  WandEvents,
  WandPointerEvent,
} from '../core/types';
import { easeInOutCirc } from './util';

const POINT_SPACING = 2;
const MIN_PEN_STEP_SQUARED = 0.0625;
const TAPER_MAX_PX = 160;
const TAPER_MIN_WIDTH = 0.12;
const FEATHER_ALPHAS: readonly number[] = Array.from(
  { length: 8 },
  (_, k) => 0.035 + 0.45 * (k / 7) ** 2.5,
);
const COMPACT_THRESHOLD = 1024;

/** The configuration fields of the chalk effect. */
export type ChalkSchema = {
  readonly size: NumberField;
  readonly maxLength: NumberField;
  readonly smoothing: NumberField;
  readonly softness: NumberField;
  readonly taper: NumberField;
  readonly fadeRate: NumberField;
  readonly color: ColorField<true>;
};

/** The schema of the chalk effect. The defaults are the values of the demo. */
export const chalkSchema: ChalkSchema = {
  size: field.number({
    label: 'Chalk size',
    description: 'The width of the stroke in pixels.',
    default: 14,
    min: 1,
    max: 50,
    step: 1,
  }),
  maxLength: field.number({
    label: 'Maximum chalk length',
    description:
      'The maximum length of a stroke in pixels. The oldest part of the stroke dissolves.',
    default: 350,
    min: 50,
    max: 2000,
    step: 10,
  }),
  smoothing: field.number({
    label: 'Smoothing',
    description: 'The steadiness of the line. The value 0 uses the raw pointer positions.',
    default: 0.35,
    min: 0,
    max: 0.95,
    step: 0.05,
  }),
  softness: field.number({
    label: 'Softness',
    description: 'The width of the feathered edge. The value 0 gives a crisp edge.',
    default: 0.65,
    min: 0,
    max: 1,
    step: 0.05,
  }),
  taper: field.number({
    label: 'Taper',
    description: 'The length of the thin tips at the two ends of the stroke.',
    default: 0.25,
    min: 0,
    max: 1,
    step: 0.05,
  }),
  fadeRate: field.number({
    label: 'Chalk vanish speed',
    description: 'The speed at which a finished stroke disappears.',
    default: 0.039,
    min: 0.001,
    max: 0.05,
    step: 0.001,
  }),
  color: field.color({
    label: 'Chalk color',
    description: 'The color of the chalk. The value null uses the theme color.',
    default: null,
    nullable: true,
  }),
};

interface Line {
  xs: number[];
  ys: number[];
  ds: number[];
  start: number;
  drawing: boolean;
  initialCount: number;
  vanishTime: number;
}

function createLine(x: number, y: number): Line {
  return {
    xs: [x],
    ys: [y],
    ds: [0],
    start: 0,
    drawing: true,
    initialCount: 0,
    vanishTime: 0,
  };
}

function pushPoint(line: Line, x: number, y: number, d: number): void {
  line.xs.push(x);
  line.ys.push(y);
  line.ds.push(d);
}

function dropDeadPoints(line: Line): void {
  const start = line.start;
  const length = line.xs.length;
  for (const values of [line.xs, line.ys, line.ds]) {
    values.copyWithin(0, start, length);
    values.length = length - start;
  }
  line.start = 0;
}

/**
 * Creates the chalk effect. The pointer draws feathered strokes that vanish with glitter.
 *
 * @returns The chalk effect for `createWand`. It emits `burst` events.
 * @example
 * createWand({ effects: [chalkEffect(), glitterEffect()] });
 */
export function chalkEffect(): Effect<'chalk', typeof chalkSchema> {
  const lines: Line[] = [];
  const burst: WandEvents['burst'] = { x: 0, y: 0, strength: 1 };
  let context: EffectContext | undefined;
  let config: EffectConfig<ChalkSchema> | undefined;
  let active: Line | undefined;
  let pointerX = 0;
  let pointerY = 0;
  let penX = 0;
  let penY = 0;
  let bufferX = new Float32Array(1024);
  let bufferY = new Float32Array(1024);
  let bufferW = new Float32Array(1024);

  function emitBurst(x: number, y: number): void {
    if (!context) return;
    burst.x = x;
    burst.y = y;
    burst.strength = 1;
    context.bus.emit('burst', burst);
  }

  function chance(probability: number): boolean {
    return context !== undefined && context.random() < probability;
  }

  function addPoint(x: number, y: number): void {
    const line = active;
    if (!line) return;
    const last = line.xs.length - 1;
    const lastX = line.xs[last] ?? x;
    const lastY = line.ys[last] ?? y;
    const lastD = line.ds[last] ?? 0;
    const dx = x - lastX;
    const dy = y - lastY;
    const distance = Math.hypot(dx, dy);
    if (distance > POINT_SPACING) {
      const steps = Math.ceil(distance / POINT_SPACING);
      for (let i = 1; i <= steps; i++) {
        const nx = lastX + (dx * i) / steps;
        const ny = lastY + (dy * i) / steps;
        pushPoint(line, nx, ny, lastD + (distance * i) / steps);
        if (chance(0.2)) emitBurst(nx, ny);
      }
    } else {
      pushPoint(line, x, y, lastD + distance);
      emitBurst(x, y);
    }
  }

  function startStroke(x: number, y: number): void {
    endStroke();
    pointerX = penX = x;
    pointerY = penY = y;
    active = createLine(x, y);
    lines.push(active);
    emitBurst(x, y);
  }

  function endStroke(): void {
    if (active) active.drawing = false;
    active = undefined;
  }

  function addDot(x: number, y: number, size: number): void {
    const line = createLine(x, y);
    const length = Math.max(POINT_SPACING * 2, size / 2);
    const steps = Math.ceil(length / POINT_SPACING);
    for (let i = 1; i <= steps; i++) {
      const d = (length * i) / steps;
      pushPoint(line, x + d, y, d);
    }
    line.drawing = false;
    lines.push(line);
    emitBurst(x, y);
  }

  function stepPen(smoothing: number, dt: number): void {
    const follow = 1 - smoothing ** dt;
    const nx = penX + (pointerX - penX) * follow;
    const ny = penY + (pointerY - penY) * follow;
    if ((nx - penX) ** 2 + (ny - penY) ** 2 < MIN_PEN_STEP_SQUARED) return;
    penX = nx;
    penY = ny;
    addPoint(penX, penY);
  }

  function enforceMaxLength(line: Line, maxLength: number): void {
    const length = line.xs.length;
    const head = line.ds[length - 1] ?? 0;
    const oldStart = line.start;
    while (line.start < length - 2 && head - (line.ds[line.start] ?? 0) > maxLength) {
      line.start++;
    }
    const trimmed = line.start - oldStart;
    if (trimmed > 0 && chance(Math.min(1, trimmed * 0.15))) {
      const index = line.start - 1;
      emitBurst(line.xs[index] ?? 0, line.ys[index] ?? 0);
    }
    if (line.start > COMPACT_THRESHOLD && line.start > length / 2) dropDeadPoints(line);
  }

  function advanceVanish(line: Line, fadeRate: number, frame: Frame): void {
    const remaining = line.xs.length - line.start;
    if (!line.initialCount) {
      line.initialCount = Math.max(1, remaining);
      line.vanishTime = 0;
    }
    line.vanishTime = Math.min(
      1,
      line.vanishTime + (fadeRate * 200 * frame.dt) / line.initialCount,
    );
    if (frame.reducedMotion) {
      if (line.vanishTime >= 1) line.start = line.xs.length;
      return;
    }
    const target = Math.max(
      0,
      Math.floor(line.initialCount * (1 - easeInOutCirc(line.vanishTime))),
    );
    const toRemove = remaining - target;
    if (toRemove <= 0) return;
    const index = line.start + toRemove - 1;
    line.start += toRemove;
    if (index < line.xs.length && chance(0.6)) {
      emitBurst(line.xs[index] ?? 0, line.ys[index] ?? 0);
    }
  }

  function ensureBuffers(size: number): void {
    if (bufferX.length >= size) return;
    const capacity = 2 ** Math.ceil(Math.log2(size));
    bufferX = new Float32Array(capacity);
    bufferY = new Float32Array(capacity);
    bufferW = new Float32Array(capacity);
  }

  function strokeLine(
    canvas: CanvasRenderingContext2D,
    line: Line,
    settings: EffectConfig<ChalkSchema>,
    frame: Frame,
  ): void {
    const { xs, ys, ds, start } = line;
    const count = xs.length - start;
    const t = line.drawing ? 0 : easeInOutCirc(line.vanishTime);
    const drift = frame.reducedMotion ? 0 : t;
    ensureBuffers(count);

    const rise = -(drift ** 1.5) * 40;
    const waveAmplitude = drift * 25;
    const phase = frame.time * 0.002;
    for (let i = 0; i < count; i++) {
      const x = xs[start + i] ?? 0;
      const y = ys[start + i] ?? 0;
      bufferX[i] = drift === 0 ? x : x + Math.sin(y * 0.02 + phase) * waveAmplitude;
      bufferY[i] = y + rise;
    }

    const d0 = ds[start] ?? 0;
    const d1 = ds[xs.length - 1] ?? 0;
    const taperLength = Math.min(settings.taper * TAPER_MAX_PX, (d1 - d0) * 0.45);
    for (let i = 0; i < count; i++) {
      let width = 1;
      if (taperLength > 0) {
        const d = ds[start + i] ?? 0;
        width = Math.min(1, (d - d0) / taperLength, (d1 - d) / taperLength);
        width *= 2 - width;
      }
      bufferW[i] = TAPER_MIN_WIDTH + (1 - TAPER_MIN_WIDTH) * width;
    }

    const outer = 1 + 2.5 * settings.softness;
    const inner = 0.9 - 0.55 * settings.softness;
    const layers = FEATHER_ALPHAS.length;
    for (let k = 0; k < layers; k++) {
      const s = k / (layers - 1);
      const alpha = (FEATHER_ALPHAS[k] ?? 0) * Math.max(0, 1 - t * (1 + 0.5 * s));
      if (alpha < 0.003) continue;
      const radius =
        (settings.size / 2) * (outer + (inner - outer) * s) * (1 + drift * 3 * (1 - s));
      canvas.globalAlpha = alpha;
      canvas.beginPath();
      let lastX = -1e9;
      let lastY = -1e9;
      for (let i = 0; i < count; i++) {
        const r = radius * (bufferW[i] ?? 0);
        const x = bufferX[i] ?? 0;
        const y = bufferY[i] ?? 0;
        const gap = Math.max(1, r * 0.35);
        const dx = x - lastX;
        const dy = y - lastY;
        if (i !== count - 1 && dx * dx + dy * dy < gap * gap) continue;
        if (r < 0.25) continue;
        canvas.moveTo(x + r, y);
        canvas.arc(x, y, r, 0, Math.PI * 2, true);
        lastX = x;
        lastY = y;
      }
      canvas.fill();
    }
  }

  return {
    name: 'chalk',
    schema: chalkSchema,
    layer: 10,
    composite: 'source-over',
    setup(effectContext) {
      context = effectContext;
    },
    configure(next) {
      config = next;
    },
    pointer(event: WandPointerEvent) {
      switch (event.phase) {
        case 'down':
          pointerX = event.x;
          pointerY = event.y;
          if (event.drawing) startStroke(event.x, event.y);
          break;
        case 'move':
          pointerX = event.x;
          pointerY = event.y;
          if (!active || !config || config.smoothing > 0) break;
          if (event.samples.length === 0) addPoint(event.x, event.y);
          for (const sample of event.samples) addPoint(sample.x, sample.y);
          break;
        case 'up':
        case 'cancel':
        case 'leave':
          endStroke();
          break;
        case 'tap':
          if (event.drawing) addDot(event.x, event.y, config?.size ?? chalkSchema.size.default);
          else emitBurst(event.x, event.y);
          break;
      }
    },
    update(frame: Frame) {
      if (!config) return;
      if (active && config.smoothing > 0) stepPen(config.smoothing, frame.dt);
      let kept = 0;
      for (const line of lines) {
        if (line.drawing) enforceMaxLength(line, config.maxLength);
        else advanceVanish(line, config.fadeRate, frame);
        if (line.drawing || line.xs.length - line.start >= 2) lines[kept++] = line;
      }
      lines.length = kept;
    },
    draw(canvas: CanvasRenderingContext2D, frame: Frame) {
      if (!config) return;
      canvas.fillStyle = config.color;
      for (const line of lines) {
        if (line.xs.length - line.start >= 2) strokeLine(canvas, line, config, frame);
      }
    },
    isIdle() {
      return lines.length === 0 && active === undefined;
    },
    clear() {
      endStroke();
      lines.length = 0;
    },
    destroy() {
      endStroke();
      lines.length = 0;
      context = undefined;
    },
  };
}
