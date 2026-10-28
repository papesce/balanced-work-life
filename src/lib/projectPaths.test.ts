import { describe, it } from "node:test";
import assert from "node:assert";
import { formatPathProgress, formatPathProgressLabel, resolveSelectedPathId } from "./projectPaths";

describe("resolveSelectedPathId", () => {
  const paths = [{ id: "first" }, { id: "second" }];

  it("keeps the current selection when it still exists", () => {
    assert.equal(resolveSelectedPathId(paths, "second", "first"), "second");
  });

  it("falls back to the remembered path when the current selection was deleted", () => {
    assert.equal(resolveSelectedPathId(paths, "deleted", "second"), "second");
  });

  it("defaults to the first path when neither selection exists", () => {
    assert.equal(resolveSelectedPathId(paths, "deleted", "also-deleted"), "first");
  });

  it("returns null when no paths exist", () => {
    assert.equal(resolveSelectedPathId([], null, null), null);
  });
});

describe("formatPathProgress", () => {
  it("formats completed and total steps", () => {
    assert.equal(formatPathProgress(3, 5), "3/5");
    assert.equal(formatPathProgress(0, 0), "0/0");
  });

  it("formats an accessible step progress label", () => {
    assert.equal(formatPathProgressLabel(3, 5), "3 of 5 steps complete");
    assert.equal(formatPathProgressLabel(0, 0), "0 of 0 steps complete");
  });
});
