---
"balanced-work-life": minor
---

- Fix PowerSync connector wedging the upload queue on unknown op.table/op: skip with a warning so batch.complete() is still reached
- Remove manual Search existing option from the Process selection panel (auto-match suggestion and Create under stay)
- Exclude cancelled/archived/deferred tasks from Balance load in fetchTasksWithTags
