// #region defaults
import { createWand } from 'magic-cursor-wand';

const wand = createWand({
  config: { theme: { color: '#fef3c7' }, chalk: { size: 20 }, cloud: { enabled: false } },
});
// #endregion defaults

// #region runtime
wand.setConfig({ chalk: { size: 30 } });
// #endregion runtime

// #region document
const saved = wand.exportConfig();
wand.importConfig(saved);
// #endregion document

// #region reset
wand.reset();
// #endregion reset
