"use client";

import { AppShell } from "@/components/AppShell";
import { ProjectCardRow } from "@/components/projects/ProjectCardRow";
import { ProjectDetailLayout } from "@/components/projects/ProjectDetailLayout";
import { ProjectListView } from "@/components/projects/ProjectListView";
import { useProjectsPage } from "@/hooks/useProjectsPage";

export default function ProjectsPage() {
  const model = useProjectsPage();

  if (model.ideasHook.loading) {
    return (
      <AppShell title="Projects">
        <div className="flex justify-center py-20">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </AppShell>
    );
  }

  if (model.selectedId && model.selectedProject) {
    return <ProjectDetailLayout model={model} />;
  }

  return (
    <ProjectListView
      columns={model.columns}
      groupedProjects={model.groupedProjects}
      visibleCount={model.visibleProjects.length}
      lensKey={model.lensKey}
      lensTabs={model.lensTabs}
      statusFilter={model.statusFilter}
       hideCompleted={model.hideCompleted}
       hideChildProjects={model.hideChildProjects}
       unclassifiedExpanded={model.unclassifiedExpanded}
      undoAction={model.undoAction}
      renderCard={(project) => <ProjectCardRow key={project.id} project={project} model={model} />}
      onLensChange={model.handleLensChange}
      onStatusFilterChange={model.setStatusFilter}
       onToggleHideCompleted={model.onToggleHideCompleted}
       onToggleHideChildProjects={model.onToggleHideChildProjects}
      onToggleUnclassifiedExpanded={model.onToggleUnclassifiedExpanded}
      onAddProject={() => void model.handleAddProject()}
      onAddProjectInGroup={(value) => void model.handleAddProjectInGroup(value)}
      onUndo={model.handleUndo}
      onDismissUndo={model.clearUndo}
    />
  );
}
