import type { WandError } from '../config/types';

/**
 * Creates the default error listener. It writes one `console.warn` for each different source.
 *
 * @returns The listener.
 */
export function createWarnOnce(): (error: WandError) => void {
  const warned = new Set<string>();
  return (error) => {
    if (warned.has(error.source)) return;
    warned.add(error.source);
    console.warn(`[magic-cursor-wand] ${error.message}`, error.cause ?? '');
  };
}

/**
 * Creates the error for an effect or a plugin that throws.
 *
 * @param source - The name of the effect or the plugin.
 * @param cause - The value that the effect threw.
 * @param disabled - `true` if the engine disabled the effect.
 * @returns The error.
 */
export function effectError(source: string, cause: unknown, disabled = false): WandError {
  const message = disabled
    ? `The effect "${source}" failed in three frames in sequence. The engine disabled it.`
    : `The section "${source}" failed. The engine continues to operate.`;
  return { kind: 'effect', source, message, cause };
}
