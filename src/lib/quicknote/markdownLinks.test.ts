import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseNoteLinks } from "./markdownLinks";

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

  it("leaves unsafe and malformed links as plain text", () => {
    const text = "[unsafe](javascript:alert(1)) and [broken](https://example.com";
    assert.deepEqual(parseNoteLinks(text), [{ type: "text", value: text }]);
  });

  it("returns an empty list for empty text", () => {
    assert.deepEqual(parseNoteLinks(""), []);
  });
});
