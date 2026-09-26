---
'magic-cursor-wand': patch
---

When the motion is `off` or the wand is stopped, the plugins continue to get the pointer events. Before this change, the cursor plugin in `replace` mode hid the pointer.
