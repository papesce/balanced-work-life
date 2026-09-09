import { Idea, IdeaLink } from "./types";

export type EffectKind = "unblocks" | "contributes" | "related" | "blockedBy";

export interface LinkEffect {
  link: IdeaLink;
  linkedIdea: Idea;
  kind: EffectKind;
  label: string;
}

export interface CompletionEffects {
  unlocked: LinkEffect[]; // other now actionable
  contributes: LinkEffect[]; // this contributed to parent/project
  related: LinkEffect[]; // informational
  blockedBy: LinkEffect[]; // completed despite incomplete prerequisites (warning)
}

const DONE_STATUSES: Idea["status"][] = ["completed", "cancelled", "archived"];

function isDone(idea: Idea): boolean {
  return DONE_STATUSES.includes(idea.status);
}

function effectLabel(link: IdeaLink, kind: EffectKind): string {
  switch (kind) {
    case "unblocks":
      return "Unblocks";
    case "blockedBy":
      return "Depended on";
    case "contributes":
      return link.link_type === "part_of" ? "Part of" : "Contributes to";
    case "related":
      return "Related to";
  }
}

/**
 * Directional interpretation for all link types.
 * - unblocks: source unblocks target => completing source unlocks target.
 * - depends_on: source depends_on target => target is prerequisite; completing target unlocks source.
 * - contributes_to / part_of: source contributes/part_of target => completing source contributes to target.
 * - related_to: symmetric, shown as related.
 *
 * Only non-done linked ideas are returned (like IdeaSearchPicker excludeDone).
 * For blockedBy, we surface prerequisites that were still not done at completion time.
 */
export function getCompletionEffects(
  completedId: string,
  ideas: Idea[],
  links: IdeaLink[],
): CompletionEffects {
  const ideasById = new Map(ideas.map((i) => [i.id, i]));
  const out: CompletionEffects = { unlocked: [], contributes: [], related: [], blockedBy: [] };

  for (const link of links) {
    const isSource = link.source_id === completedId;
    const isTarget = link.target_id === completedId;
    if (!isSource && !isTarget) continue;

    const otherId = isSource ? link.target_id : link.source_id;
    const other = ideasById.get(otherId);
    if (!other) continue;
    // For unlocked/contributes/related we hide already-done; for blockedBy we keep incomplete only
    const otherDone = isDone(other);

    switch (link.link_type) {
      case "unblocks": {
        if (isSource && !otherDone) {
          out.unlocked.push({
            link,
            linkedIdea: other,
            kind: "unblocks",
            label: effectLabel(link, "unblocks"),
          });
        } else if (isTarget && !otherDone) {
          // You were blocked by source; completing you doesn't unlock source, but track as related?
          // Show as related for completeness, but not as unlocked.
          out.related.push({ link, linkedIdea: other, kind: "related", label: "Unblocked by" });
        }
        break;
      }
      case "depends_on": {
        if (isTarget && !otherDone) {
          // other depends_on you => you are prerequisite => completing you unlocks other
          out.unlocked.push({ link, linkedIdea: other, kind: "unblocks", label: "Unblocks" });
        } else if (isSource && !otherDone) {
          // you depend_on other and other is still not done => you completed despite dependency
          out.blockedBy.push({
            link,
            linkedIdea: other,
            kind: "blockedBy",
            label: effectLabel(link, "blockedBy"),
          });
        } else if (isSource && otherDone) {
          // dependency already satisfied — not shown
        }
        break;
      }
      case "contributes_to":
      case "part_of": {
        if (isSource && !otherDone) {
          out.contributes.push({
            link,
            linkedIdea: other,
            kind: "contributes",
            label: effectLabel(link, "contributes"),
          });
        } else if (isTarget && !otherDone) {
          // someone contributes to you; completing you doesn't auto affect them — show as related
          out.related.push({ link, linkedIdea: other, kind: "related", label: "Has part" });
        }
        break;
      }
      case "related_to": {
        if (!otherDone) {
          out.related.push({ link, linkedIdea: other, kind: "related", label: "Related to" });
        }
        break;
      }
    }
  }

  return out;
}

export function hasAnyEffects(e: CompletionEffects): boolean {
  return (
    e.unlocked.length > 0 ||
    e.contributes.length > 0 ||
    e.related.length > 0 ||
    e.blockedBy.length > 0
  );
}

export function countEffects(e: CompletionEffects): number {
  return e.unlocked.length + e.contributes.length + e.related.length + e.blockedBy.length;
}
