import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextDetailFocus } from "./detailFocus";

describe("nextDetailFocus", () => {
  it("returns null when the focus target is the project root (toggles back to root)", () => {
    assert.equal(nextDetailFocus("p1", "p1"), null);
  });

  it("returns the focus target when it is a non-root node", () => {
    assert.equal(nextDetailFocus("p1", "t1"), "t1");
  });

  it("returns the focus target when nothing is selected", () => {
    assert.equal(nextDetailFocus(null, "t1"), "t1");
  });

  it("returns null when focusing nothing", () => {
    assert.equal(nextDetailFocus("p1", null), null);
  });
});
