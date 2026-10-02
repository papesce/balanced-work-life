"use client";

import { useMemo } from "react";
import { useProjectTreeStore } from "./projectTreeStore";
import { useLens } from "@/components/lens";
import type { useClassifications } from "@/hooks/useClassifications";
import type { useTaskTags } from "@/hooks/useTaskTags";
import { AREA_LABELS, AREA_ORDER } from "@/lib/constants";

type ClassificationsApi = ReturnType<typeof useClassifications>;
type TaskTagsApi = ReturnType<typeof useTaskTags>;

/**
 * Phase 1 lookup memo: area lens def + priority accessor shared by
 * projects list/detail so `getTagsForIdea` maps aren't rebuilt per card.
 */
export function useProjectLookups(
  taskTagsHook: TaskTagsApi,
  classifications: Pick<ClassificationsApi, "schemes" | "options" | "classifications">,
  lensKey: string,
) {
  const customs = useMemo(
    () => ({
      area: {
        options: AREA_ORDER.map((a) => ({ value: a, label: AREA_LABELS[a] })),
        valueOf: (ideaId: string) => taskTagsHook.getTagsForIdea(ideaId)[0]?.area ?? null,
      },
    }),
    // tagsByIdea identity changes only when the join rows change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taskTagsHook.tagsByIdea],
  );

  const lens = useLens({
    schemes: classifications.schemes,
    classificationOptions: classifications.options,
    classifications: classifications.classifications,
    lensKey,
    customs,
  });

  return { customs, ...lens };
}

/** Direct children of a project from the shared tree (stable empty array avoided). */
export function useProjectChildren(projectId: string) {
  return useProjectTreeStore((s) => s.tree.childrenById.get(projectId));
}
