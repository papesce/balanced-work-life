# balanced-work-life

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
