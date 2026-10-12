---
"balanced-work-life": minor
---

Project detail view is now a resizable split: task List on the left, Paths canvas on the right.

**Split layout:** the List / Paths toggle becomes a List | Split | Paths switcher (persisted globally as `projectViewMode`, default Split, with persisted `projectSplitRatio`). The split uses `react-resizable-panels` with a draggable, keyboard-accessible divider; each pane has a collapse button that switches to the other single-pane mode. Detail renders full-width so both panes fit, and the canvas re-fits its viewport after divider drags and collapses.

**Drag from List to canvas:** each List row gains a second handle (arrow icon) using native HTML5 drag with the same `application/project-task` payload as the old tray, so existing canvas drop logic is reused untouched. The reorder grip stays @dnd-kit-only. Clicking (or Enter/Space on) the handle adds the task to the selected path — the touch fallback. Handles dim when the task is already in the path or no path is selected. Opt-in via `IdeaTree` props, so other tree views are unaffected; narrow split panes use a compact row variant (type/area chips hidden).

**Tray:** the "Project tasks" strip above the canvas is removed in split mode (the List is the source) and kept in Paths-only mode via a `showTray` prop.

**Responsive:** below 1024px (same threshold as the app sidebar) split is disabled and the switcher offers List / Paths only. Hide-completed stays shared between panes.
