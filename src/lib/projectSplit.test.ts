import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clampSplitRatio, resolveEffectiveMode, SPLIT_MIN_WIDTH } from "./projectSplit";

describe("clampSplitRatio", () => {
  it("clamps to 10–80", () => {
    assert.equal(clampSplitRatio(5), 10);
    assert.equal(clampSplitRatio(95), 80);
    assert.equal(clampSplitRatio(40), 40);
  });
  it("falls back to 35 on non-numeric input", () => {
    assert.equal(clampSplitRatio(NaN), 35);
    assert.equal(clampSplitRatio(undefined), 35);
    assert.equal(clampSplitRatio("abc"), 35);
  });
});

describe("resolveEffectiveMode", () => {
  it("keeps split on wide screens", () => {
    assert.equal(resolveEffectiveMode("split", SPLIT_MIN_WIDTH), "split");
    assert.equal(resolveEffectiveMode("split", 1600), "split");
  });
  it("falls back to list below the threshold", () => {
    assert.equal(resolveEffectiveMode("split", SPLIT_MIN_WIDTH - 1), "list");
    assert.equal(resolveEffectiveMode("split", 375, "paths"), "paths");
  });
  it("leaves single-pane modes untouched", () => {
    assert.equal(resolveEffectiveMode("list", 375), "list");
    assert.equal(resolveEffectiveMode("paths", 375), "paths");
    assert.equal(resolveEffectiveMode("paths", 1600), "paths");
  });
});
