export interface SelectablePath {
  id: string;
}

export function resolveSelectedPathId(
  paths: SelectablePath[],
  selectedId: string | null,
  rememberedId: string | null,
): string | null {
  if (selectedId && paths.some((path) => path.id === selectedId)) return selectedId;
  if (rememberedId && paths.some((path) => path.id === rememberedId)) return rememberedId;
  return paths[0]?.id ?? null;
}

export function formatPathProgress(completedSteps: number, totalSteps: number): string {
  return `${completedSteps}/${totalSteps}`;
}
