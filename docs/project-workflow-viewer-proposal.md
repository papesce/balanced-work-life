# Project workflow viewer/editor proposal

## Goal

Add a visual mini-plan to a project’s detail view. A user can see project tasks as workflow nodes, arrange them from start to finish, and connect tasks to express what must happen next. The graph is a planning aid: task status, area, and schedule stay attached to the existing task, and changing workflow order does not reschedule tasks or change their status.

## Fit with the current app

- The project detail route is `/projects?projectId=…` in `src/app/projects/page.tsx`; it currently renders the editable `IdeaTree` and has an “Add task” action.
- `Idea` already carries status, scheduled date/time, duration, sort order, and parent project membership. Area is supplied through task tags (`useTaskTags`), and classification data is available through `useClassifications`.
- `@xyflow/react` and `dagre` are already installed. `src/components/brainstorm/GraphView.tsx` provides a React Flow reference, though it is a read-only graph of idea links.
- Existing idea links (`idea_links`) model semantic relationships such as `unblocks` and `depends_on`; they do not store graph coordinates. Reusing these links as workflow edges would mix a project plan with the app’s general idea graph.

## Proposed experience

Add **List | Workflow** view controls in the project detail header. List remains the default and retains its current behavior. Workflow opens a left-to-right canvas with three regions:

1. **Task tray:** project tasks not yet placed on the canvas, searchable and optionally filtered by status/area.
2. **Canvas:** placed tasks as nodes, connected by directed “next” edges. Support drag from tray, repositioning nodes, connecting, selecting, and deleting a connection. Add auto-layout and fit-view controls.
3. **Inspector:** selected task details and existing task actions (edit, status, schedule, open notes). Keep task editing in the established task UI where practical.

Node cards should show a truncated title, status chip, primary area chip, and scheduled date/time when set. Use existing status styles, area colors, and tag lookup helpers. Show a clear empty state with an “Add tasks to workflow” action. On narrow screens, collapse the tray and inspector behind buttons so the canvas remains usable.

Workflow connections mean “this task comes next after that task.” They should not silently mark an existing semantic dependency or enforce completion gates. If users need that later, add an explicit edge type/label.

## Data and persistence

Keep `ideas.parent_id` as the source of truth for which tasks belong to a project. Persist workflow membership, edge endpoints, and canvas positions separately so graph ordering does not reorder the existing task tree.

Recommended initial schema: one `project_workflows` row per project, with `project_id`, `user_id`, and a versioned JSON `document` containing placed task IDs, node positions, and directed edges. Use a unique constraint on `project_id`, RLS scoped to `user_id`, and PowerSync replication. This keeps an initial single-workflow feature small while allowing a later migration to normalized node/edge tables if collaboration or querying requires it. Validate that referenced task IDs still belong to the project when reading/writing; ignore stale nodes and prune edges whose endpoints no longer exist. Tasks created after the workflow is started stay in the tray until added.

The document should be debounced on edits, saved optimistically through PowerSync, and tolerate concurrent updates with a document `updated_at`/revision field. Do not persist derived status, area, or schedule values in the graph document: render those from live task/tag data. Treat positions and workflow edges as user-authored workflow metadata.

## Implementation outline

1. **Workflow model and storage:** define a typed workflow document and pure helpers to validate project membership, remove stale references, and detect cycles. Add migration, RLS, PowerSync schema/table registration, and a hook following the existing live `useQuery` plus local write pattern.
2. **Project view integration:** add a local view-mode preference (per project if useful; otherwise global), preserve current list behavior, and mount a client-only workflow canvas in the selected-project branch.
3. **Task nodes and tray:** implement a custom XYFlow node using live task and tag/classification lookups. Add drag/drop from tray; dropping a task creates workflow membership only and does not move its parent or alter its schedule.
4. **Edges and layout:** let users connect nodes with a “next” edge, prevent self-links and cycles, support edge deletion, and provide dagre left-to-right auto-layout. Save position changes on drag stop rather than every pointer movement.
5. **Task actions and feedback:** reuse existing update/status/schedule actions and undo where possible. Show save/error state, empty/loading states, and a toast/undo affordance when removing a task from the workflow. Removing a node should not delete the underlying task.
6. **Accessibility and responsive behavior:** provide keyboard focusable node selection, labeled controls, and tray-based add/remove actions as alternatives to drag-and-drop.

## Suggested component boundaries

- `src/components/projects/ProjectWorkflowView.tsx`: canvas, tray, inspector composition and project scoping.
- `src/components/projects/WorkflowTaskNode.tsx`: custom React Flow task card.
- `src/hooks/useProjectWorkflow.ts`: live document subscription and mutation API.
- `src/lib/projectWorkflow.ts`: schema types, validation, stale-reference cleanup, cycle checks, layout input/output helpers.

## Key decisions and acceptance criteria

- Existing project task list and its mutations continue to work unchanged.
- A user can place any descendant task in the workflow, connect it in sequence, reposition it, and reload with the same graph.
- Node status, area, and schedule reflect task changes made in the list or elsewhere without duplicating those fields.
- Adding/removing/reordering workflow nodes never changes task parentage, status, or schedule. Removing a workflow node never deletes the task.
- Cycles are rejected with a clear inline explanation; branching and merging are allowed.
- Deleted or moved-out tasks are removed from the rendered graph safely, and stale edges do not break loading.
- Workflow data is user-scoped and replicated through the same offline-friendly PowerSync path as the rest of the app.

## Open product question

Should workflow sequences allow branches and parallel work (recommended; naturally supported by a graph), or should they enforce one linear chain? The implementation above allows branches and merges while presenting the common case as a left-to-right sequence.
