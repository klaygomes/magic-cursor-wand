// #region schema
import { createWand, type Effect, field, type Point } from 'magic-cursor-wand';

const schema = {
  radius: field.number({
    label: 'Radius',
    description: 'The radius of the dot in pixels.',
    default: 6,
    min: 1,
    max: 40,
    step: 1,
  }),
  color: field.color({
    label: 'Color',
    description: 'The color of the dot. The value null uses the theme color.',
    default: null,
    nullable: true,
  }),
};
// #endregion schema

// #region effect
export function dotEffect(): Effect<'dot', typeof schema> {
  let radius = schema.radius.default;
  let color = '#ffffff';
  let point: Point | null = null;

  return {
    name: 'dot',
    schema,
    layer: 30,
    setup() {},
    configure(config) {
      radius = config.radius;
      color = config.color;
    },
    pointer(event) {
      point =
        event.phase === 'leave' || event.phase === 'cancel' ? null : { x: event.x, y: event.y };
    },
    update() {},
    draw(context) {
      if (!point) return;
      context.fillStyle = color;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    },
    isIdle: () => point === null,
    clear() {
      point = null;
    },
    destroy() {},
  };
}
// #endregion effect

// #region register
createWand({
  effects: [dotEffect()],
  config: { dot: { radius: 10 } },
});
// #endregion register
