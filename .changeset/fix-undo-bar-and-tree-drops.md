---
"balanced-work-life": patch
---

Fix undo bar placement and tree drop-zone accuracy

- Pin the undo bar as a fixed toast centered above the bottom navigation instead of rendering it inline
- Prefer pointer position for tree drag-and-drop collision detection so drop zones match the cursor's third of a row, falling back to closest-center for keyboard drags
