const DURATION_MS = 1800;
const START_DELAY_MS = 700;

function pointAt(bounds: DOMRect, progress: number): { x: number; y: number } {
  const x = bounds.left + bounds.width * (0.12 + 0.76 * progress);
  const wave = Math.sin(progress * Math.PI * 2.4) * 0.22 + (0.5 - progress) * 0.18;
  return { x, y: bounds.top + bounds.height * (0.52 + wave) };
}

function dispatch(target: Element, type: string, point: { x: number; y: number }): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
      pointerId: 99,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    }),
  );
}

/** Draws one stroke across the element, so the page shows the effect before the first interaction. */
export function autoplayStroke(slate: Element): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let stopped = false;
  const stop = (event: Event): void => {
    if (event.isTrusted) stopped = true;
  };
  window.addEventListener('pointermove', stop, { once: true });
  window.addEventListener('pointerdown', stop, { once: true });

  setTimeout(() => {
    if (stopped) return;
    const bounds = slate.getBoundingClientRect();
    const start = performance.now();
    dispatch(slate, 'pointermove', pointAt(bounds, 0));
    dispatch(slate, 'pointerdown', pointAt(bounds, 0));

    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      if (stopped) {
        dispatch(slate, 'pointerup', pointAt(bounds, eased));
        return;
      }
      dispatch(slate, 'pointermove', pointAt(bounds, eased));
      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }
      dispatch(slate, 'pointerup', pointAt(bounds, 1));
    };
    requestAnimationFrame(step);
  }, START_DELAY_MS);
}
