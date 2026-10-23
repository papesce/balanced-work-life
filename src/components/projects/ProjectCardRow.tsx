"use client";

import { ProjectCard } from "@/components/projects/ProjectCard";
import { hintForValue } from "@/lib/classificationHelp";
import type { ProjectsPageModel } from "@/hooks/useProjectsPage";
import type { Idea } from "@/lib/types";

/**
 * A single project card in the list board. Computes per-card values from the
 * shared page model and forwards them to ProjectCard.
 */
export function ProjectCardRow({ project, model }: { project: Idea; model: ProjectsPageModel }) {
  const { done, total } = model.statOf(project.id);
  const tags = model.taskTagsHook.getTagsForIdea(project.id);
  const children = model.childrenOf(project.id);

  return (
    <ProjectCard
      project={project}
      done={done}
      total={total}
      area={tags[0]?.area ?? null}
      areaTags={tags}
      allTags={model.tagsHook.tags}
      priority={model.priorityOf(project.id)}
      lensKey={model.lensKey}
      lensLabel={model.lensTabs.find((t) => t.key === model.lensKey)?.label ?? "Group"}
      groupValue={model.valueOf(project.id)}
      groupOptions={model.columns}
      groupHint={hintForValue(model.lensKey, model.valueOf(project.id))}
      renaming={model.renamingCardId === project.id}
      renameDraft={model.renameDraft}
      expanded={model.expandedCards.has(project.id)}
      hideCompleted={model.hideCompleted}
      tasks={children}
      allIdeas={model.ideasHook.ideas}
      links={model.linksHook.links}
      hasChildren={children.length > 0}
      getTagsForIdea={model.taskTagsHook.getTagsForIdea}
      onSelect={model.handleSelect}
      onStartRename={model.startCardRename}
      onRenameDraftChange={model.setRenameDraft}
      onCommitRename={(id) => void model.commitCardRename(id)}
      onCancelRename={() => model.setRenamingCardId(null)}
      onSetPriority={(id, v) => void model.handleSetPriority(id, v)}
      onSetClassification={(id, v) => void model.handleSetClassification(id, v)}
      onReplaceAreaTag={(projectId, tag) => void model.handleReplaceAreaTag(projectId, tag)}
      onRemoveAreaTag={(projectId, tagId) =>
        void model.taskTagsHook.removeTagFromTask(projectId, tagId)
      }
      onCreateTag={model.tagsHook.createTag}
      onToggleExpand={model.toggleCard}
      onQuickAddTask={(id) => void model.quickAddTaskToProject(id)}
      onUpdateStatus={(id, status) => void model.actions.updateIdea(id, { status })}
      onToggleTask={(id, completed) =>
        void (completed ? model.actions.markDone(id) : model.actions.markUndone(id))
      }
      onDelete={model.actions.deleteIdea}
      onSchedule={model.actions.scheduleIdea}
      onCreateLink={model.actions.createLink}
      onDeleteLink={model.actions.deleteLink}
      onMove={model.actions.moveIdea}
      onCreateParent={model.actions.createParentAndMove}
      onMoved={(id) => {
        if (id) model.ideasHook.expandIdea(id);
      }}
      onOpenNotes={model.openNotes}
    />
  );
}
