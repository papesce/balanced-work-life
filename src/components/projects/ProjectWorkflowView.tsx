"use client";

import { useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Idea, IdeaLink, LinkType, Tag } from "@/lib/types";
import type { PathItem, PathPosition } from "@/lib/paths";
import { WorkflowTaskNode } from "./WorkflowTaskNode";
import { useWorkflowGraph, type FlowNode } from "./workflow/useWorkflowGraph";
import { useWorkflowInteractions } from "./workflow/useWorkflowInteractions";
import { WorkflowToolbar } from "./workflow/WorkflowToolbar";
import {
  PendingLinkPicker,
  WorkflowEmptyState,
  WorkflowMessage,
} from "./workflow/WorkflowOverlays";

const nodeTypes = { workflowTask: WorkflowTaskNode };

interface Props {
  tasks: Idea[];
  links: IdeaLink[];
  items: PathItem[];
  onAddItem: (ideaId: string, x: number, y: number) => Promise<void>;
  onRemoveItem: (ideaId: string) => Promise<void>;
  onMoveItems: (positions: PathPosition[]) => Promise<void>;
  tagsForTask: (id: string) => Tag[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => Promise<void>;
  onOpenNotes: (id: string) => void;
  onCreateLink: (sourceId: string, targetId: string, type: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  /** True when both tasks co-occur in some other path (for the delete-everywhere notice). */
  isPairInAnotherPath?: (aIdeaId: string, bIdeaId: string) => boolean;
  /** Mirrors the project "Hide completed" toggle: hides completed nodes on the canvas. */
  hideCompleted?: boolean;
  /** Mirrors the project "Hide closed" toggle: hides completed/cancelled/missed/archived nodes. */
  hideClosed?: boolean;
  /** Bump to re-fit the viewport after the pane resizes or collapses. */
  fitTick?: number;
  /** Fill the parent pane height instead of the fixed 600px canvas. */
  fillHeight?: boolean;
}

export function ProjectWorkflowView({
  tasks,
  links,
  items,
  onAddItem,
  onRemoveItem,
  onMoveItems,
  tagsForTask,
  onUpdateTask,
  onOpenNotes,
  onCreateLink,
  onDeleteLink,
  isPairInAnotherPath,
  hideCompleted,
  hideClosed,
  fitTick = 0,
  fillHeight = false,
}: Props) {
  const [message, setMessage] = useState("");
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    flow,
    taskMap,
    placedIds,
    dependsLinks,
    statusById,
    progress,
    handleUpdateStatus,
    savePositions,
  } = useWorkflowGraph({
    tasks,
    links,
    items,
    tagsForTask,
    onUpdateTask,
    onOpenNotes,
    onMoveItems,
    hideCompleted,
    hideClosed,
    fitTick,
    setMessage,
  });
  const {
    selectedId,
    setSelectedId,
    pending,
    setPending,
    handleNodesChange,
    handleEdgesChange,
    onConnect,
    confirmPendingLink,
    removeSelected,
    autoLayout,
    dropTask,
  } = useWorkflowInteractions({
    edges,
    nodes,
    setNodes,
    setEdges,
    flow,
    taskMap,
    tagsForTask,
    dependsLinks,
    statusById,
    handleUpdateStatus,
    onOpenNotes,
    onAddItem,
    onRemoveItem,
    onCreateLink,
    onDeleteLink,
    isPairInAnotherPath,
    savePositions,
    setMessage,
  });

  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${
        fillHeight ? "flex h-full min-h-[480px] flex-col" : ""
      }`}
    >
      <WorkflowToolbar
        done={progress.done}
        total={progress.total}
        canLayout={nodes.length > 0}
        selectedId={selectedId}
        onAutoLayout={autoLayout}
        onFitView={() => flow.fitView({ padding: 0.2, duration: 250 })}
        onRemoveSelected={removeSelected}
      />
      {placedIds.size > 8 && (
        <p className="border-b border-gray-200 px-3 py-1.5 text-[11px] text-gray-400 dark:border-gray-700">
          This path is getting large — consider splitting into another path or a sub-project.
        </p>
      )}
      <div
        className={
          fillHeight
            ? "relative min-h-[400px] w-full flex-1"
            : "relative h-[600px] min-h-[560px] w-full"
        }
        onDragOver={(e) => e.preventDefault()}
        onDrop={dropTask}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId(null)}
          onNodeDragStop={(_, __, nextNodes) => savePositions(nextNodes as FlowNode[])}
          fitView
          minZoom={0.25}
          maxZoom={1.5}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls position="bottom-left" />
          <MiniMap
            pannable
            zoomable
            style={{ width: 140, height: 100 }}
            className="!border-gray-200 !bg-white/90 dark:!border-gray-700 dark:!bg-gray-800/90"
          />
        </ReactFlow>
        {nodes.length === 0 && <WorkflowEmptyState />}
        <WorkflowMessage message={message} onDismiss={() => setMessage("")} />
        {pending && (
          <PendingLinkPicker
            sourceText={taskMap.get(pending.visualSource)?.text ?? "step"}
            targetText={taskMap.get(pending.visualTarget)?.text ?? "step"}
            onConfirm={confirmPendingLink}
            onCancel={() => setPending(null)}
          />
        )}
      </div>
    </div>
  );
}

export function ProjectWorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <ProjectWorkflowView {...props} />
    </ReactFlowProvider>
  );
}
