export interface WorkflowPosition {
  x: number;
  y: number;
}
export interface WorkflowNode {
  taskId: string;
  position: WorkflowPosition;
}
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}
export interface ProjectWorkflow {
  version: 1;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
export const EMPTY_WORKFLOW: ProjectWorkflow = { version: 1, nodes: [], edges: [] };

export function parseWorkflow(value: unknown): ProjectWorkflow {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return EMPTY_WORKFLOW;
    }
  }
  if (!raw || typeof raw !== "object") return EMPTY_WORKFLOW;
  const doc = raw as Partial<ProjectWorkflow>;
  const nodes = Array.isArray(doc.nodes)
    ? doc.nodes.filter(
        (n): n is WorkflowNode =>
          !!n &&
          typeof n.taskId === "string" &&
          Number.isFinite(n.position?.x) &&
          Number.isFinite(n.position?.y),
      )
    : [];
  const ids = new Set(nodes.map((n) => n.taskId));
  const edges = Array.isArray(doc.edges)
    ? doc.edges.filter(
        (e): e is WorkflowEdge =>
          !!e &&
          typeof e.id === "string" &&
          ids.has(e.source) &&
          ids.has(e.target) &&
          e.source !== e.target,
      )
    : [];
  return { version: 1, nodes, edges };
}

export function wouldCreateWorkflowCycle(
  edges: WorkflowEdge[],
  source: string,
  target: string,
): boolean {
  if (source === target) return true;
  const outgoing = new Map<string, string[]>();
  for (const edge of edges)
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current === source) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(outgoing.get(current) ?? []));
  }
  return false;
}
