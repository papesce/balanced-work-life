export type NoteTextSegment =
  { type: "text"; value: string } | { type: "link"; label: string; href: string };

function isSafeNoteHref(href: string): boolean {
  try {
    const protocol = new URL(href).protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

export function parseNoteLinks(text: string): NoteTextSegment[] {
  const segments: NoteTextSegment[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let cursor = 0;

  for (const match of text.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    const [source, label, href] = match;
    if (!isSafeNoteHref(href)) continue;
    if (index > cursor) segments.push({ type: "text", value: text.slice(cursor, index) });
    segments.push({ type: "link", label, href });
    cursor = index + source.length;
  }

  if (cursor < text.length) segments.push({ type: "text", value: text.slice(cursor) });
  return segments;
}
