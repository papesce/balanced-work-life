export type NoteTextSegment =
  { type: "text"; value: string } | { type: "link"; label: string; href: string };

export interface NoteIdeaSegment {
  type: "idea";
  label: string;
  ideaId: string;
}

export type QuickNotePreviewSegment = NoteTextSegment | NoteIdeaSegment;

interface PositionedSegment {
  segment: QuickNotePreviewSegment;
  sourceStart: number;
  sourceEnd: number;
  labelSourceStart?: number;
  rawLabel?: string;
}

export interface NoteTextSelection {
  start: number;
  end: number;
  text: string;
}

export function formatIdeaReference(label: string, ideaId: string): string {
  const escapedLabel = label.replace(/[\\\]]/g, "\\$&");
  return `[${escapedLabel}](idea:${ideaId})`;
}

export function markIdeaReferenceInNote(
  noteText: string,
  selection: { start: number; end: number; text: string },
  ideaId: string,
): string {
  const markedSelection = `✓ ${formatIdeaReference(selection.text, ideaId)}`;
  return noteText.slice(0, selection.start) + markedSelection + noteText.slice(selection.end);
}

function isSafeNoteHref(href: string): boolean {
  try {
    const protocol = new URL(href).protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

function parsePositionedNoteLinks(text: string, includeIdeaLinks: boolean): PositionedSegment[] {
  const segments: PositionedSegment[] = [];
  const linkPattern = /\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)/g;
  let cursor = 0;

  for (const match of text.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    const [source, rawLabel, href] = match;
    const label = rawLabel.replace(/\\([\\[\]])/g, "$1");
    const ideaId = includeIdeaLinks && href.startsWith("idea:") ? href.slice(5) : "";
    if (ideaId) {
      if (index > cursor) {
        segments.push({
          segment: { type: "text", value: text.slice(cursor, index) },
          sourceStart: cursor,
          sourceEnd: index,
        });
      }
      segments.push({
        segment: { type: "idea", label, ideaId },
        sourceStart: index,
        sourceEnd: index + source.length,
        labelSourceStart: index + 1,
        rawLabel,
      });
      cursor = index + source.length;
      continue;
    }
    if (!isSafeNoteHref(href)) continue;
    if (index > cursor) {
      segments.push({
        segment: { type: "text", value: text.slice(cursor, index) },
        sourceStart: cursor,
        sourceEnd: index,
      });
    }
    segments.push({
      segment: { type: "link", label, href },
      sourceStart: index,
      sourceEnd: index + source.length,
      labelSourceStart: index + 1,
      rawLabel,
    });
    cursor = index + source.length;
  }

  if (cursor < text.length) {
    segments.push({
      segment: { type: "text", value: text.slice(cursor) },
      sourceStart: cursor,
      sourceEnd: text.length,
    });
  }
  return segments;
}

export function parseNoteLinks(text: string): NoteTextSegment[];
export function parseNoteLinks(text: string, includeIdeaLinks: true): QuickNotePreviewSegment[];
export function parseNoteLinks(text: string, includeIdeaLinks = false): QuickNotePreviewSegment[] {
  return parsePositionedNoteLinks(text, includeIdeaLinks).map(({ segment }) => segment);
}

/**
 * Maps a visible preview-text range back to the note source. A rendered link
 * label must be selected in full so selection actions can safely replace its
 * source markup.
 */
export function mapPreviewSelectionToSource(
  noteText: string,
  visibleStart: number,
  visibleEnd: number,
): NoteTextSelection | null {
  if (
    !Number.isInteger(visibleStart) ||
    !Number.isInteger(visibleEnd) ||
    visibleStart < 0 ||
    visibleEnd <= visibleStart
  ) {
    return null;
  }

  const offsets: { start: number; end: number }[] = [];
  let visibleText = "";
  for (const {
    segment,
    sourceStart,
    sourceEnd,
    labelSourceStart,
    rawLabel,
  } of parsePositionedNoteLinks(noteText, true)) {
    if (segment.type === "text") {
      visibleText += segment.value;
      for (let i = 0; i < segment.value.length; i++) {
        offsets.push({ start: sourceStart + i, end: sourceStart + i + 1 });
      }
      continue;
    }

    const segmentVisibleStart = visibleText.length;
    const segmentVisibleEnd = segmentVisibleStart + segment.label.length;
    if (
      visibleStart < segmentVisibleEnd &&
      visibleEnd > segmentVisibleStart &&
      (visibleStart > segmentVisibleStart || visibleEnd < segmentVisibleEnd)
    ) {
      return null;
    }

    visibleText += segment.label;
    let rawOffset = 0;
    const sourceLabelStart = labelSourceStart ?? sourceStart;
    const segmentSourceStart =
      segment.type === "idea" && noteText.slice(sourceStart - 2, sourceStart) === "✓ "
        ? sourceStart - 2
        : sourceStart;
    while (rawOffset < (rawLabel?.length ?? 0)) {
      const escaped =
        rawLabel![rawOffset] === "\\" && /[\\[\]]/.test(rawLabel![rawOffset + 1] ?? "");
      const length = escaped ? 2 : 1;
      const visibleCharacter = rawLabel!.slice(rawOffset + (escaped ? 1 : 0), rawOffset + length);
      for (let i = 0; i < visibleCharacter.length; i++) {
        offsets.push({
          start: rawOffset === 0 ? segmentSourceStart : sourceLabelStart + rawOffset,
          end:
            rawOffset + length === rawLabel!.length
              ? sourceEnd
              : sourceLabelStart + rawOffset + length,
        });
      }
      rawOffset += length;
    }
  }

  if (visibleEnd > offsets.length || visibleText.length !== offsets.length) return null;
  const selectedOffsets = offsets.slice(visibleStart, visibleEnd);
  const first = selectedOffsets[0];
  const last = selectedOffsets[selectedOffsets.length - 1];
  if (!first || !last) return null;

  return {
    start: first.start,
    end: last.end,
    text: visibleText.slice(visibleStart, visibleEnd),
  };
}
