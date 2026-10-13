"use client";

import { IdeaActionMenu } from "@/components/shared/IdeaActionMenu";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { HorizonQuickAssign } from "@/components/horizon/HorizonQuickAssign";
import {
  HorizonTagsSlot,
  StatusChipSlot,
  TypeBadgeSlot,
} from "@/components/horizon/slots/HorizonRowSlots";
import type {
  Idea,
  IdeaLink,
  IdeaNode as IdeaNodeType,
  LifeArea,
  LinkType,
  Tag,
} from "@/lib/types";

interface HorizonRowTrailingProps {
  node: IdeaNodeType;
  ideas: Idea[];
  links: IdeaLink[];
  linkCount: number;
  allTags: Tag[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSchedule: (id: string, date: string | null) => Promise<void>;
  onMove: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onAddTag: (ideaId: string, tag: Tag) => void;
  onRemoveTag: (ideaId: string, tagId: string) => void;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  onEdit: () => void;
  onOpenNotes: () => void;
}

export function HorizonRowTrailing({
  node,
  ideas,
  links,
  linkCount,
  allTags,
  getTagsForIdea,
  onUpdate,
  onDelete,
  onSchedule,
  onMove,
  onCreateLink,
  onDeleteLink,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onEdit,
  onOpenNotes,
}: HorizonRowTrailingProps) {
  return (
    <>
      <NotesIndicator hasNotes={!!node.notes?.trim()} onClick={onOpenNotes} />
      <TypeBadgeSlot node={node} onUpdate={onUpdate} />
      <HorizonTagsSlot
        node={node}
        allTags={allTags}
        getTagsForIdea={getTagsForIdea}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onCreateTag={onCreateTag}
      />
      <StatusChipSlot node={node} onUpdate={onUpdate} />
      <HorizonQuickAssign node={node} onUpdate={onUpdate} />
      {linkCount > 0 && (
        <span className="flex-shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300">
          {linkCount}
        </span>
      )}
      <IdeaActionMenu
        idea={node}
        allIdeas={ideas}
        links={links}
        hasChildren={node.children.length > 0}
        getTagsForIdea={getTagsForIdea}
        onEdit={onEdit}
        onDelete={onDelete}
        onSchedule={onSchedule}
        onCreateLink={onCreateLink}
        onDeleteLink={onDeleteLink}
        onMove={onMove}
        hiddenActions={["move"]}
        onShowDetails={onOpenNotes}
        currentView="horizon"
      />
    </>
  );
}
