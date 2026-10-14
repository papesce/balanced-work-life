---
"balanced-work-life": minor
---

Paths canvas, project filters/grouping, Horizon committed filters, and row/menu fixes.

**Paths canvas:** new synced `paths` / `path_items` tables with position persistence, RLS-safe uploads, labeled edges with link-type picker on connect, and horizon classification order hints. Project detail tasks group by classification (Option A).

**Project filters:** Filters menu with Hide closed and Hide completed (hide-completed persisted on by default), per-mode task add, and removal of the header Add task in favor of contextual adds. Split-mode tray strip removed with canvas height fix.

**Horizon:** committed filter split into upcoming / overdue, filters menu, top-level make action, and quick-note backlog alert.

**Fixes:** inline link panel in drawer, persisted global search Done toggle, anchored attach/link flyouts beside the menu, and done ideas hidden in the attach picker.

**Refactors (no behavior change):** page/component splits across projects, planner, timeline, horizon, brainstorm, goals, tree rows, `useIdeas`, PowerSync schema/connector/sync handlers, and themed `ConfirmDialog`.
