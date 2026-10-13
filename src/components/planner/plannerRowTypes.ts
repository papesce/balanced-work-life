import type { useSortable } from "@dnd-kit/sortable";
import type { UndoAction } from "@/lib/tasks/undo";
import type { RescheduleAction } from "@/lib/tasks/rescheduleTask";
import type { Idea, IdeaLink, LifeArea, LinkType, Tag } from "@/lib/types";

/** Full prop bundle for a planner task row (list → sortable → row). */
export interface PlannerRowProps {
  task: Idea;
  area: LifeArea;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMoveTaskBetweenAreas?: (taskId: string, fromArea: LifeArea, toArea: LifeArea) => void;
  getTagsForIdea?: (ideaId: string) => Tag[];
  allTags?: Tag[];
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  showDragHandle?: boolean;
  dragHandleProps?: {
    attributes: React.HTMLAttributes<HTMLElement>;
    listeners: ReturnType<typeof useSortable>["listeners"];
  };
  isDragging?: boolean;
  onUndoAction?: (action: UndoAction) => void;
  onAttach?: (taskId: string, parentId: string) => Promise<void>;
  allIdeas?: Idea[];
  links?: IdeaLink[];
  onCreateLink?: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink?: (id: string) => Promise<void>;
}
