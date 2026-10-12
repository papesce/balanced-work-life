import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LENSES,
  buildLensColumns,
  resolveLens,
  type LensSchemeInfo,
} from "@/lib/horizonLenses";

const SCHEMES: LensSchemeInfo[] = [
  { key: "term", label: "Term", options: ["short", "medium", "long"] },
  { key: "nnl", label: "NNL", options: ["now", "next", "later"] },
  { key: "priority", label: "Priority", options: ["high", "medium", "low"] },
  { key: "attention", label: "Attention", options: ["a", "b"] },
  {
    key: "moscow",
    label: "MoSCoW",
    options: ["must", "should", "could", "wont"],
  },
  {
    key: "when",
    label: "When",
    options: [
      "this_week",
      "next_week",
      "this_month",
      "next_month",
      "this_year",
      "next_year",
      "later",
    ],
  },
  { key: "effort", label: "Effort", options: ["quick", "focused", "substantial", "deep", "epic"] },
  { key: "impact", label: "Impact", options: ["high", "medium", "low"] },
];

describe("DEFAULT_LENSES table", () => {
  it("ships the six lenses with names, descriptions, columns and default splits", () => {
    assert.deepEqual(
      DEFAULT_LENSES.map((l) => [l.id, l.name, l.description, l.primaryScheme]),
      [
        ["closest", "Closest in time", "What comes first", "when"],
        ["easiest", "Easiest first", "What I can resolve with little effort", "effort"],
        ["matters", "What matters most", "What I can't skip", "moscow"],
        ["ready", "Ready to move", "What is ready to advance or finish", "attention"],
        ["looking-ahead", "Looking ahead", "Short, medium and long term", "term"],
        ["payoff", "Biggest payoff", "What adds the most value", "impact"],
      ],
    );
    const byId = new Map(DEFAULT_LENSES.map((l) => [l.id, l]));
    assert.deepEqual(byId.get("closest")!.columnOrder, [
      "this_week",
      "next_week",
      "this_month",
      "next_month",
      "this_year",
      "next_year",
      "later",
    ]);
    // Each lens defaults every column (incl. unclassified) to one
    // secondary scheme that preserves the old tiebreaker ordering.
    const expectSplits = (id: string, scheme: string) => {
      const splits = byId.get(id)!.defaultSplits;
      assert.ok(Object.keys(splits).length > 0, id);
      assert.deepEqual(new Set(Object.values(splits)), new Set([scheme]), id);
      assert.equal(splits["unclassified"], scheme, `${id} unclassified`);
    };
    expectSplits("closest", "nnl");
    expectSplits("easiest", "priority");
    expectSplits("matters", "priority");
    expectSplits("ready", "effort");
    expectSplits("looking-ahead", "priority");
    expectSplits("payoff", "effort");
  });
});

describe("resolveLens", () => {
  it("resolves a lens id", () => {
    const { lens, synthesized } = resolveLens("payoff", SCHEMES);
    assert.equal(synthesized, false);
    assert.equal(lens.primaryScheme, "impact");
    assert.equal(lens.name, "Biggest payoff");
  });

  it("resolves a scheme key to the matching default lens (first match)", () => {
    assert.equal(resolveLens("when", SCHEMES).lens.id, "closest");
    assert.equal(resolveLens("impact", SCHEMES).lens.id, "payoff");
  });

  it("resolves legacy term to the looking-ahead lens", () => {
    const { lens, synthesized } = resolveLens("term", SCHEMES);
    assert.equal(synthesized, false);
    assert.equal(lens.id, "looking-ahead");
  });

  it("synthesizes legacy nnl/priority with scheme order and no default splits", () => {
    for (const key of ["nnl", "priority"]) {
      const { lens, synthesized } = resolveLens(key, SCHEMES);
      assert.equal(synthesized, true);
      assert.deepEqual(lens.columnOrder, SCHEMES.find((s) => s.key === key)!.options);
      assert.equal(lens.name, SCHEMES.find((s) => s.key === key)!.label);
      assert.deepEqual(lens.defaultSplits, {});
    }
  });

  it("falls back to the term lens for unknown keys", () => {
    assert.equal(resolveLens("nope", SCHEMES).lens.id, "looking-ahead");
  });
});

describe("buildLensColumns", () => {
  it("uses the explicit column order then Unclassified", () => {
    const lens = DEFAULT_LENSES.find((l) => l.id === "looking-ahead")!;
    const cols = buildLensColumns(lens, [
      { value: "short", label: "Short" },
      { value: "medium", label: "Medium" },
      { value: "long", label: "Long" },
    ]);
    assert.deepEqual(
      cols.map((c) => c.key),
      ["short", "medium", "long", null],
    );
  });

  it("keeps unlisted runtime options instead of dropping them", () => {
    const lens = DEFAULT_LENSES.find((l) => l.id === "looking-ahead")!;
    const cols = buildLensColumns(lens, [
      { value: "short", label: "Short" },
      { value: "extra", label: "Extra" },
      { value: "long", label: "Long" },
    ]);
    assert.deepEqual(
      cols.map((c) => c.key),
      ["short", "long", "extra", null],
    );
  });

  it("filters columnOrder entries that no longer exist", () => {
    const lens = DEFAULT_LENSES.find((l) => l.id === "looking-ahead")!;
    const cols = buildLensColumns(lens, [{ value: "short", label: "Short" }]);
    assert.deepEqual(
      cols.map((c) => c.key),
      ["short", null],
    );
  });
});
