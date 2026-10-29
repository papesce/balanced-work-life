import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { formatIdeaReference, parseNoteLinks } from "./markdownLinks";

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
