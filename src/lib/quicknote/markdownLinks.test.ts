import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  formatIdeaReference,
  mapPreviewSelectionToSource,
  markIdeaReferenceInNote,
  parseNoteLinks,
} from "./markdownLinks";

describe("parseNoteLinks", () => {
  it("splits Markdown links from surrounding text", () => {
    assert.deepEqual(parseNoteLinks("See [example](https://example.com) today"), [
      { type: "text", value: "See " },
      { type: "link", label: "example", href: "https://example.com" },
      { type: "text", value: " today" },
    ]);
  });

  it("supports mailto links and preserves newlines", () => {
    assert.deepEqual(parseNoteLinks("First line\n[email](mailto:team@example.com)"), [
      { type: "text", value: "First line\n" },
      { type: "link", label: "email", href: "mailto:team@example.com" },
    ]);
  });

  it("parses idea references for Quick Note previews only", () => {
    const text = "✓ [Call the dentist](idea:idea-123)";
    assert.deepEqual(parseNoteLinks(text, true), [
      { type: "text", value: "✓ " },
      { type: "idea", label: "Call the dentist", ideaId: "idea-123" },
    ]);
    assert.deepEqual(parseNoteLinks(text), [{ type: "text", value: text }]);
  });

  it("unescapes linked labels and leaves malformed idea references as text", () => {
    assert.deepEqual(
      parseNoteLinks(`✓ ${formatIdeaReference("Review ] brackets", "idea-123")}`, true),
      [
        { type: "text", value: "✓ " },
        { type: "idea", label: "Review ] brackets", ideaId: "idea-123" },
      ],
    );
    const malformed = "[missing id](idea:)";
    assert.deepEqual(parseNoteLinks(malformed, true), [{ type: "text", value: malformed }]);
  });

  it("leaves unsafe and malformed links as plain text", () => {
    const text = "[unsafe](javascript:alert(1)) and [broken](https://example.com";
    assert.deepEqual(parseNoteLinks(text), [{ type: "text", value: text }]);
  });

  it("returns an empty list for empty text", () => {
    assert.deepEqual(parseNoteLinks(""), []);
  });
});

describe("markIdeaReferenceInNote", () => {
  it("replaces the selected text with a checked idea reference and preserves surrounding text", () => {
    const note = "Before buy elastic bands after";
    const selection = { start: 7, end: 24, text: "buy elastic bands" };

    assert.equal(
      markIdeaReferenceInNote(note, selection, "idea-123"),
      "Before ✓ [buy elastic bands](idea:idea-123) after",
    );
  });
});

describe("mapPreviewSelectionToSource", () => {
  it("maps plain preview text to its source range", () => {
    assert.deepEqual(mapPreviewSelectionToSource("Before selected text after", 7, 20), {
      start: 7,
      end: 20,
      text: "selected text",
    });
  });

  it("maps rendered Markdown link labels to their complete source markup", () => {
    const note = "Read [help](https://example.com) now";
    assert.deepEqual(mapPreviewSelectionToSource(note, 5, 9), {
      start: 5,
      end: note.indexOf(" now"),
      text: "help",
    });
  });

  it("maps rendered idea references and escaped label characters", () => {
    const note = `✓ ${formatIdeaReference("Review ] brackets", "idea-123")}`;
    assert.deepEqual(mapPreviewSelectionToSource(note, 2, "✓ Review ] brackets".length), {
      start: 0,
      end: note.length,
      text: "Review ] brackets",
    });
  });

  it("rejects partial rendered-link labels that cannot safely be replaced", () => {
    assert.equal(mapPreviewSelectionToSource("[help](https://example.com)", 1, 3), null);
  });

  it("returns null for collapsed or out-of-range preview selections", () => {
    assert.equal(mapPreviewSelectionToSource("text", 2, 2), null);
    assert.equal(mapPreviewSelectionToSource("text", 0, 5), null);
    assert.equal(mapPreviewSelectionToSource("text", -1, 2), null);
  });
});
