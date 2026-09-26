// #region container
import { useWand } from 'magic-cursor-wand/react';
import { useRef } from 'react';

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  useWand({ touchAction: 'pan-y' }, ref);
  return <div ref={ref} style={{ position: 'relative', height: 400 }} />;
}
// #endregion container
