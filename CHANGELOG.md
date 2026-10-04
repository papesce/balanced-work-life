# balanced-work-life

## 0.5.0

### Minor Changes

- 5747b17: - Add Quick Note feature: transient scratchpad for fast capture with process mode
  - Add quick_notes table, PowerSync schema, and sync rules
  - Add keyboard shortcut Cmd/Ctrl+Alt+N to toggle Quick Note panel
  - Add IdeaSearchPicker props: initialQuery and matchAllWords for word-boundary matching
- 915a938: - Add named Horizon views: pick a primary classification, set per-column Split lenses, and save the mix with a name; switcher supports retrieve, rename, duplicate, overwrite, revert, delete, and default-on-load with per-view summaries
  - Fix month-grid nested `<button>` hydration error by rendering day cells as keyboard-accessible `div[role=button]`
  - Drop deprecated Supabase `auth.lock` option (lockless session coordination)
- f9e067c: - Fix PowerSync connector wedging the upload queue on unknown op.table/op: skip with a warning so batch.complete() is still reached
  - Remove manual Search existing option from the Process selection panel (auto-match suggestion and Create under stay)
  - Exclude cancelled/archived/deferred tasks from Balance load in fetchTasksWithTags

### Patch Changes

- b131d68: Fix backup silently dropping classifications and quick notes: export/import quick_notes, classification schemes/options/idea_classifications (v3 backup, old files still import), and restore lens prefs onto empty keys only.
- 7656684: - Calm Quick Note save feedback: footer indicator and header unsaved dot share a grace-timed status hook, so steady typing no longer flickers amber/pulse on every pause-save cycle
  - Stabilize Quick Note header Process count with deferred updates so it settles when typing pauses instead of ticking mid-word
- bcc231c: - Default productivity signal to null instead of 'productive' on task creation
  - Remove productivity signal picker from task creation forms; only settable via context menu
  - Fix task_tags UUID generation to use proper UUIDs instead of composite strings
- ef7cb2b: - Fix quick note losing typed text: autosave now reads the synchronously-updated draft ref instead of lagging React state, so unmount/blur/pagehide flushes can no longer persist stale content
  - Fix quick note empty-overwrite and cross-note flushes via draft provenance tracking, truthful dirty flag, and refused mismatched-target writes
  - Surface PowerSync upload failures per operation instead of silently dropping them; add sync-status transition logging
  - Refactor QuickNoteContext into focused modules (notes, draft, persistence, operations) with a single write path and shared idea-insert SQL
- 7b611bd: - Regroup the task row action menu by intent (Date / Organize / Navigate / Destructive) with consequence previews, collapsing retry/try-now/reschedule/move into a single reschedule action that records attempt history only for strictly past dates
  - Unify today/selected highlighting across timeline agenda, week, and month views with a shared DateChip and formatDayTitle helper, plus a sticky Today jump pill

## 0.4.0

### Minor Changes

- Add tree card mode to brainstorm and horizon, remove generic cards view, and ship focus/notes/lanes supporting changes

  - Add a shared card-mode toggle (persisted via `brainstorm-card-mode`) that renders each tree row as a card with notes preview in brainstorm (`Tree` view) and horizon (all three horizons); includes `cardMode` in generic tree options
  - Remove the generic flat `IdeaCardGrid` cards view from brainstorm; keep tree (with Rows/Cards switch) and graph
  - Hide Edit/Insert mode buttons when card mode is active in brainstorm and force view mode
  - Add horizon lane configurability (per-horizon lanes, drag-to-lane, lane config dialog), in-focus flag with horizon/tree filtering and Tree indent fixes
  - Generalize notes to a shared drawer with `NotesIndicator` across all views, hide description field and keep notes only
  - Add common Reveal in context menu, PowerSync `IdeasTable` in_focus/lanes migrations, and related tree/detail UI polish

### Patch Changes

- a28cb3c: Bump pinned nanoid to 3.3.18 (high-severity Dependabot alert)

  Updates the `nanoid` override in `pnpm-workspace.yaml` from 3.3.17 to 3.3.18,
  which patches the advisory where custom generators could loop indefinitely when
  size is zero.

- e65e5cf: Fix undo bar placement and tree drop-zone accuracy

  - Pin the undo bar as a fixed toast centered above the bottom navigation instead of rendering it inline
  - Prefer pointer position for tree drag-and-drop collision detection so drop zones match the cursor's third of a row, falling back to closest-center for keyboard drags

- Regroup the task row action menu by intent with consequence previews and a single reschedule semantic

  - Collapse `retry_today`, `try_now`, `reschedule` and `move` into one `{ type: "reschedule"; newDate; time?; recordAttempt? }` action (plus unchanged `defer`); attempt history is now recorded only when the old date is strictly in the past, with an explicit `recordAttempt` override and a shared `willRecordAttempt` predicate used by both labels and patches so they cannot drift
  - Replace the duplicated Timeline/Planner menus with one shared `TaskRowMenu` grouped Date / Organize / Navigate / Destructive: overdue tasks show an emphasized "Carry to today" (with "keeps {Mon D} as missed" subtext) plus "Do it now" (today + rounded time) and a date submenu with a no-history "Fix a wrong date" option; today tasks get "Move to tomorrow" with an explicit "mark today as missed" variant; Archive stays destructive-first with planner-only Delete kept below it
  - Migrate all call-sites (row menus, triage actions, day-slot "try now", week/month drag-drop) to the new action, remove the Move/Reschedule label flip, and reuse `SchedulePicker` in both rows; add `node --test` unit coverage for the attempt-recording rules (`pnpm test`)

## 0.3.0

### Minor Changes

- 434665c: Simplify timeline range selection with Focus, Planning, Review, and Horizon presets, add calendar-aware month windows, and require formatting, lint, TypeScript, and production-build checks before deployment.
- ff336df: Remove the Backlog Inbox view from the daily planner (right-panel tab, mobile tab, and Move to Backlog/Inbox menu actions) since tasks can now be tracked directly in the timeline and brainstorm.
- 80b1714: Migrate data layer to local-first PowerSync: live SQLite queries replace direct Supabase reads across ideas, links, tags, task tags, balance, calendar, and week views; add task_tags id/user_id migration and PowerSync bucket stream config.
- 987f1d9: Add a Timeline button to the daily planner header that jumps to the timeline anchored on the active date, and add Move/Reschedule to Today and Move/Reschedule Date options to the daily planner task context menu.
- d3beedb: Add past/future timeline range filters with task counts, a Jump to Today button, task triage and deferred review actions, and an option to unschedule a task back to the day's pending list from the daily timeline.

### Patch Changes

- 3142a00: Fix the timeline preset dropdown JSX and add pre-commit formatting, lint, and TypeScript validation.
- 4812a24: Show selected tag name instead of area label in the slot form area picker button.
- 2d20e44: Make the tag/area picker a true multi-select: checking a tag adds it without removing others, unchecking removes only that tag, tasks must keep at least one area/tag, and the schedule card shows the primary tag. Fix scheduled-task creation so the dayslot dialog always dismisses and can no longer create duplicates.
- 1f0eaf3: Resolve ESLint warnings, stabilize hook dependencies, exclude local artifacts from linting, and optimize user avatar rendering.
- f57f702: Update vulnerable transitive dependencies and add pnpm security overrides, reducing the dependency audit to zero known vulnerabilities.
- 6dbd71a: Remove the backup page in favor of a UserMenu, unify toolbar controls and header chrome, add navigate-to-attempt with highlight in deferred rows, hover feedback in the shared status picker, keep the Today button actionable with a latched state, and drop z-index layering from timeline cards.
