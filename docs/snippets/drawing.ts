// #region modifier
import { createWand, drawWithModifier } from 'magic-cursor-wand';

createWand({ shouldDraw: drawWithModifier('Alt') });
// #endregion modifier

// #region ignore
createWand({ ignoreSelector: '.no-wand, [data-no-wand]' });
// #endregion ignore
