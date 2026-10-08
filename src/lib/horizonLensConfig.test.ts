import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  exclusiveDefaults,
  horizonViewToRow,
  parseSecondaryMapText,
  parseSplitsText,
  planLegacyImport,
  rowToHorizonView,
  sanitizeView,
} from "@/lib/horizonViews";

describe("rowToHorizonView", () => {
  it("maps a valid row, parsing JSON splits text", () => {
    const view = rowToHorizonView({
      id: "v1",
      name: "Attention",
      primary_scheme: "attention",
      splits: JSON.stringify({ short: "priority", unclassified: null }),
      sort_by: "priority",
    });
    assert.deepEqual(view, {
      id: "v1",
      name: "Attention",
      primary: "attention",
      splits: { short: "priority", unclassified: null },
      sortBy: "priority",
    });
  });

  it("falls back to empty splits on bad JSON, never throws", () => {
    const view = rowToHorizonView({
      id: "v1",
      name: "Bad",
      primary_scheme: "term",
      splits: "not-json{{{",
      sort_by: "manual",
    });
    assert.deepEqual(view?.splits, {});
  });

  it("unwraps double-encoded JSON strings", () => {
    const inner = JSON.stringify({ short: "priority" });
    const view = rowToHorizonView({
      id: "v1",
      name: "Double",
      primary_scheme: "term",
      splits: JSON.stringify(inner),
      sort_by: "manual",
    });
    assert.deepEqual(view?.splits, { short: "priority" });
  });

  it("rejects rows with missing id/name/primary", () => {
    assert.equal(
      rowToHorizonView({ id: "", name: "x", primary_scheme: "term", splits: "{}", sort_by: null }),
      null,
    );
    assert.equal(
      rowToHorizonView({
        id: "v",
        name: "  ",
        primary_scheme: "term",
        splits: "{}",
        sort_by: null,
      }),
      null,
    );
  });

  it("round-trips through horizonViewToRow", () => {
    const view = sanitizeView({
      id: "v1",
      name: "R",
      primary: "term",
      splits: { short: "priority" },
      sortBy: "manual",
    })!;
    const row = horizonViewToRow(view, "u1");
    assert.equal(row.primary_scheme, "term");
    assert.deepEqual(JSON.parse(row.splits!), { short: "priority" });
    assert.deepEqual(rowToHorizonView({ ...row, sort_by: row.sort_by }), view);
  });
});

describe("parseSplitsText / parseSecondaryMapText", () => {
  it("parses objects and JSON text, empty string to {}", () => {
    assert.deepEqual(parseSplitsText({ a: "b", c: null }), { a: "b", c: null });
    assert.deepEqual(parseSplitsText('{"a":"b"}'), { a: "b" });
    assert.deepEqual(parseSplitsText(""), {});
    assert.deepEqual(parseSplitsText(null), {});
    assert.deepEqual(parseSplitsText("garbage"), {});
  });

  it("cleans the secondary map shape, dropping non-string values to null", () => {
    const parsed = parseSecondaryMapText(
      JSON.stringify({ term: { short: "priority", stale: 42 }, junk: 7 }),
    );
    assert.deepEqual(parsed, { term: { short: "priority", stale: null } });
  });
});

describe("exclusiveDefaults", () => {
  it("setting a view clears the lens and vice versa", () => {
    assert.deepEqual(exclusiveDefaults({ viewId: "v1" }), {
      default_view_id: "v1",
      default_lens_id: null,
    });
    assert.deepEqual(exclusiveDefaults({ lensId: "payoff" }), {
      default_view_id: null,
      default_lens_id: "payoff",
    });
  });

  it("empty input clears both", () => {
    assert.deepEqual(exclusiveDefaults({}), { default_view_id: null, default_lens_id: null });
  });
});

describe("planLegacyImport", () => {
  const legacyViews = [
    { id: "v1", name: "One", primary: "term", splits: {}, sortBy: "manual" },
    { id: "v2", name: "Two", primary: "priority", splits: { short: "nnl" }, sortBy: "priority" },
    { id: "bad", name: "  ", primary: "term", splits: {} },
  ];

  it("imports valid views, adopts default + map when remote is empty", () => {
    const plan = planLegacyImport(
      {
        views: legacyViews,
        defaultViewId: "v1",
        secondaryMap: { term: { short: "priority" } },
      },
      { viewCount: 0, hasDefault: false, hasSecondaryMap: false },
    );
    assert.deepEqual(
      plan.viewsToInsert.map((v) => v.id),
      ["v1", "v2"],
    );
    assert.equal(plan.adoptDefault, "v1");
    assert.deepEqual(plan.adoptSecondaryMap, { term: { short: "priority" } });
  });

  it("is idempotent: never overwrites existing remote data", () => {
    const plan = planLegacyImport(
      {
        views: legacyViews,
        defaultViewId: "v1",
        secondaryMap: { term: { short: "priority" } },
      },
      { viewCount: 2, hasDefault: true, hasSecondaryMap: true },
    );
    // Views still offered as INSERT OR IGNORE (safe re-run), but nothing adopted.
    assert.deepEqual(
      plan.viewsToInsert.map((v) => v.id),
      ["v1", "v2"],
    );
    assert.equal(plan.adoptDefault, null);
    assert.equal(plan.adoptSecondaryMap, null);
  });

  it("ignores a default pointing at an unknown view id", () => {
    const plan = planLegacyImport(
      { views: legacyViews, defaultViewId: "ghost", secondaryMap: {} },
      { viewCount: 0, hasDefault: false, hasSecondaryMap: false },
    );
    assert.equal(plan.adoptDefault, null);
    assert.equal(plan.adoptSecondaryMap, null);
  });

  it("silently skips invalid legacy entries", () => {
    const plan = planLegacyImport(
      { views: "not-an-array", defaultViewId: null, secondaryMap: "garbage" },
      { viewCount: 0, hasDefault: false, hasSecondaryMap: false },
    );
    assert.deepEqual(plan.viewsToInsert, []);
    assert.equal(plan.adoptDefault, null);
    assert.equal(plan.adoptSecondaryMap, null);
  });
});
