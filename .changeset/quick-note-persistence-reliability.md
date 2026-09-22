---
"balanced-work-life": patch
---

- Fix quick note losing typed text: autosave now reads the synchronously-updated draft ref instead of lagging React state, so unmount/blur/pagehide flushes can no longer persist stale content
- Fix quick note empty-overwrite and cross-note flushes via draft provenance tracking, truthful dirty flag, and refused mismatched-target writes
- Surface PowerSync upload failures per operation instead of silently dropping them; add sync-status transition logging
- Refactor QuickNoteContext into focused modules (notes, draft, persistence, operations) with a single write path and shared idea-insert SQL
