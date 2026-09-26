// #region page
import { useWand } from 'magic-cursor-wand/react';

export function Page() {
  useWand({ config: { chalk: { size: 20 } } });
  return <main>My page</main>;
}
// #endregion page
