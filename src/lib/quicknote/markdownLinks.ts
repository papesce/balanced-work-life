export type NoteTextSegment =
  { type: "text"; value: string } | { type: "link"; label: string; href: string };

export interface NoteIdeaSegment {
  type: "idea";
  label: string;
  ideaId: string;
}

export type QuickNotePreviewSegment = NoteTextSegment | NoteIdeaSegment;

export function formatIdeaReference(label: string, ideaId: string): string {
  const escapedLabel = label.replace(/[\\\]]/g, "\\$&");
  return `[${escapedLabel}](idea:${ideaId})`;
}

function isSafeNoteHref(href: string): boolean {
  try {
    const protocol = new URL(href).protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

export function parseNoteLinks(text: string): NoteTextSegment[];
export function parseNoteLinks(text: string, includeIdeaLinks: true): QuickNotePreviewSegment[];
export function parseNoteLinks(text: string, includeIdeaLinks = false): QuickNotePreviewSegment[] {
  const segments: QuickNotePreviewSegment[] = [];
  const linkPattern = /\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)/g;
  let cursor = 0;

  for (const match of text.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    const [source, rawLabel, href] = match;
    const label = rawLabel.replace(/\\([\\[\]])/g, "$1");
    const ideaId = includeIdeaLinks && href.startsWith("idea:") ? href.slice(5) : "";
    if (ideaId) {
      if (index > cursor) segments.push({ type: "text", value: text.slice(cursor, index) });
      segments.push({ type: "idea", label, ideaId });
      cursor = index + source.length;
      continue;
    }
    if (!isSafeNoteHref(href)) continue;
    if (index > cursor) segments.push({ type: "text", value: text.slice(cursor, index) });
    segments.push({ type: "link", label, href });
    cursor = index + source.length;
  }

  if (cursor < text.length) segments.push({ type: "text", value: text.slice(cursor) });
  return segments;
}
