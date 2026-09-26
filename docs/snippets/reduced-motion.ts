// #region motion
import { createWand } from 'magic-cursor-wand';

const wand = createWand({ config: { theme: { motion: 'reduced' } } });
// #endregion motion

// #region off
wand.setConfig({ theme: { motion: 'off' } });
// #endregion off
