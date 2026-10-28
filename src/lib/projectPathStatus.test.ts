import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getPathStatusPresentation,
  normalizePathStatus,
  toStoredPathStatus,
} from "./projectPathStatus";

describe("path status presentation", () => {
  it("uses path-specific labels for the stored path statuses", () => {
    assert.equal(getPathStatusPresentation("draft").label, "Open");
    assert.equal(getPathStatusPresentation("completed").label, "Done");
    assert.equal(getPathStatusPresentation("paused").label, "Paused");
    assert.equal(getPathStatusPresentation("cancelled").label, "Cancelled");
    assert.notEqual(
      getPathStatusPresentation("open").className,
      getPathStatusPresentation("paused").className,
    );
  });

  it("maps the visible open status to and from its stored draft value", () => {
    assert.equal(normalizePathStatus("draft"), "open");
    assert.equal(toStoredPathStatus("open"), "draft");
    assert.equal(toStoredPathStatus("completed"), "completed");
  });
});
