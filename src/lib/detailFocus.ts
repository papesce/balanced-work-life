/**
 * The detail view focus rule: selecting the project root again returns focus
 * to null (back to the root), while any other node focuses that node. Shared by
 * the detail tree `onFocus` and the breadcrumb `onSelectBreadcrumb`.
 */
export function nextDetailFocus(selectedId: string | null, id: string | null): string | null {
  return id === selectedId ? null : id;
}
