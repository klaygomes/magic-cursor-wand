// #region start
import { createWand } from 'magic-cursor-wand';

const wand = createWand();
// #endregion start

// #region change
wand.setConfig({ chalk: { size: 20 } });
// #endregion change

// #region destroy
wand.destroy();
// #endregion destroy
