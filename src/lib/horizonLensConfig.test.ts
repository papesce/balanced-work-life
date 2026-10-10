import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  exclusiveDefaults,
  horizonLensSeedId,
  horizonViewToRow,
  parseSecondaryMapText,
  parseSplitsText,
  parseStringArrayText,
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
    });
    assert.deepEqual(view, {
      id: "v1",
      name: "Attention",
      primary: "attention",
      description: "",
      column_order: [],
      splits: { short: "priority", unclassified: null },
      is_builtin: false,
    });
  });

  it("falls back to empty splits on bad JSON, never throws", () => {
    const view = rowToHorizonView({
      id: "v1",
      name: "Bad",
      primary_scheme: "term",
      splits: "not-json{{{",
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
    });
    assert.deepEqual(view?.splits, { short: "priority" });
  });

  it("rejects rows with missing id/name/primary", () => {
    assert.equal(
      rowToHorizonView({ id: "", name: "x", primary_scheme: "term", splits: "{}" }),
      null,
    );
    assert.equal(
      rowToHorizonView({
        id: "v",
        name: "  ",
        primary_scheme: "term",
        splits: "{}",
      }),
      null,
    );
  });

  it("ignores removed fields (tiebreakers, sort_by) from old rows", () => {
    const view = rowToHorizonView({
      id: "v-old-fields",
      name: "Old",
      primary_scheme: "term",
      splits: "{}",
      tiebreakers: JSON.stringify([{ scheme: "effort", direction: "asc" }]),
      sort_by: "priority",
    } as never);
    assert.deepEqual(view, {
      id: "v-old-fields",
      name: "Old",
      primary: "term",
      description: "",
      column_order: [],
      splits: {},
      is_builtin: false,
    });
  });

  it("round-trips through horizonViewToRow", () => {
    const view = sanitizeView({
      id: "v1",
      name: "R",
      primary: "term",
      splits: { short: "priority" },
    })!;
    const row = horizonViewToRow(view, "u1");
    assert.equal(row.primary_scheme, "term");
    assert.deepEqual(JSON.parse(row.splits!), { short: "priority" });
    assert.deepEqual(rowToHorizonView(row), view);
  });
});

describe("editable lens fields", () => {
  it("round-trips description, column order, splits and builtin flag", () => {
    const view = sanitizeView({
      id: "v9",
      name: "Payoff",
      primary: "impact",
      description: "What adds the most value",
      column_order: ["high", "medium", "low"],
      splits: { high: "effort" },
      is_builtin: true,
    })!;
    const row = horizonViewToRow(view, "u1");
    assert.equal(row.description, "What adds the most value");
    assert.deepEqual(JSON.parse(row.column_order!), ["high", "medium", "low"]);
    assert.deepEqual(JSON.parse(row.splits!), { high: "effort" });
    assert.deepEqual(rowToHorizonView(row), view);
  });

  it("defaults new fields for rows written before the migration", () => {
    const view = rowToHorizonView({
      id: "v-old",
      name: "Old",
      primary_scheme: "term",
      splits: "{}",
    });
    assert.deepEqual(view?.description, "");
    assert.deepEqual(view?.column_order, []);
    assert.equal(view?.is_builtin, false);
  });

  it("drops invalid string-array entries, never throws", () => {
    assert.deepEqual(parseStringArrayText("garbage"), []);
  });

  it("seed ids are deterministic uuids per user+lens", () => {
    const a = horizonLensSeedId("u1", "payoff");
    assert.equal(a, horizonLensSeedId("u1", "payoff"));
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.notEqual(a, horizonLensSeedId("u1", "closest"));
    assert.notEqual(a, horizonLensSeedId("u2", "payoff"));
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
  const UUID_V1 = "11111111-1111-4111-8111-111111111111";
  const UUID_V2 = "22222222-2222-4222-8222-222222222222";
  const legacyViews = [
    { id: UUID_V1, name: "One", primary: "term", splits: {} },
    { id: UUID_V2, name: "Two", primary: "priority", splits: { short: "nnl" } },
    { id: "bad", name: "  ", primary: "term", splits: {} },
  ];

  it("imports valid views, adopts default + map when remote is empty", () => {
    const plan = planLegacyImport(
      {
        views: legacyViews,
        defaultViewId: UUID_V1,
        secondaryMap: { term: { short: "priority" } },
      },
      { viewCount: 0, hasDefault: false, hasSecondaryMap: false },
    );
    assert.deepEqual(
      plan.viewsToInsert.map((v) => v.id),
      [UUID_V1, UUID_V2],
    );
    assert.equal(plan.adoptDefault, UUID_V1);
    assert.deepEqual(plan.adoptSecondaryMap, { term: { short: "priority" } });
  });

  it("is idempotent: never overwrites existing remote data", () => {
    const plan = planLegacyImport(
      {
        views: legacyViews,
        defaultViewId: UUID_V1,
        secondaryMap: { term: { short: "priority" } },
      },
      { viewCount: 2, hasDefault: true, hasSecondaryMap: true },
    );
    // Views still offered as INSERT OR IGNORE (safe re-run), but nothing adopted.
    assert.deepEqual(
      plan.viewsToInsert.map((v) => v.id),
      [UUID_V1, UUID_V2],
    );
    assert.equal(plan.adoptDefault, null);
    assert.equal(plan.adoptSecondaryMap, null);
  });

  it("remaps legacy non-uuid ids (e.g. seed-term) to uuids", () => {
    const plan = planLegacyImport(
      {
        views: [{ id: "seed-term", name: "Term", primary: "term", splits: {} }],
        defaultViewId: "seed-term",
        secondaryMap: {},
      },
      { viewCount: 0, hasDefault: false, hasSecondaryMap: false },
    );
    assert.equal(plan.viewsToInsert.length, 1);
    const remapped = plan.viewsToInsert[0].id;
    assert.match(remapped, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    // Default follows the remapped id so prefs stay consistent.
    assert.equal(plan.adoptDefault, remapped);
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
