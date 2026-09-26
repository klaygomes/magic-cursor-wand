import { useEffect, useRef, useState } from 'react';
import type { ComposeConfig } from '../config/types';
import type { Effect, Plugin, Wand } from '../core/types';
import { type CreateWandOptions, createWand, type DefaultEffects } from '../core/wand';

/** A React ref to the element that contains the wand. */
export interface WandTargetRef {
  readonly current: HTMLElement | null;
}

type SectionMap = Record<string, Record<string, unknown> | undefined>;

function shallowEqual(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => Object.is(left[key], right[key]));
}

function changedSections(
  previous: SectionMap | undefined,
  next: SectionMap | undefined,
): SectionMap | undefined {
  if (!next) return undefined;
  let patch: SectionMap | undefined;
  for (const name of Object.keys(next)) {
    const section = next[name];
    if (!section || shallowEqual(previous?.[name], section)) continue;
    patch = { ...patch, [name]: section };
  }
  return patch;
}

/**
 * Create a wand when the component mounts, and destroy the wand when the component unmounts.
 *
 * The hook reads `effects`, `plugins`, `providers` and `target` one time. To change them, remount the component with a new `key`.
 * When `config` changes, the hook compares each section and calls `setConfig` with the changed sections.
 *
 * @param options - The options of `createWand`.
 * @param ref - A ref to the container element. If you give it, the wand uses container mode.
 * @returns The wand, or null before the first effect runs.
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * const wand = useWand({ config: { chalk: { size: size } } }, ref);
 */
export function useWand<
  const E extends readonly Effect[] = DefaultEffects,
  const P extends readonly Plugin[] = [],
>(
  options: CreateWandOptions<E, P> = {},
  ref?: WandTargetRef,
): Wand<ComposeConfig<[...E, ...P]>> | null {
  const [wand, setWand] = useState<Wand<ComposeConfig<[...E, ...P]>> | null>(null);
  const initialOptions = useRef(options);
  const initialRef = useRef(ref);
  const appliedConfig = useRef<SectionMap | undefined>(undefined);

  useEffect(() => {
    const creation = initialOptions.current;
    const containerRef = initialRef.current;
    const target = containerRef?.current ?? undefined;
    if (containerRef && !target) return;
    const created = createWand<E, P>(target ? { ...creation, target } : creation);
    appliedConfig.current = creation.config as SectionMap | undefined;
    setWand(created);
    return () => {
      created.destroy();
      setWand((current) => (current === created ? null : current));
    };
  }, []);

  const config = options.config as SectionMap | undefined;
  useEffect(() => {
    if (!wand) return;
    const patch = changedSections(appliedConfig.current, config);
    appliedConfig.current = config;
    if (patch) wand.setConfig(patch as Parameters<typeof wand.setConfig>[0]);
  }, [wand, config]);

  return wand;
}
