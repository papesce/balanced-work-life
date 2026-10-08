import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LENSES,
  buildLensColumns,
  buildLensComparator,
  compareByTiebreakers,
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
  it("ships the six lenses with names, descriptions, columns and tiebreakers", () => {
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
    assert.deepEqual(byId.get("closest")!.tiebreakers, [
      { scheme: "nnl", direction: "asc" },
      { scheme: "priority", direction: "asc" },
    ]);
    assert.deepEqual(byId.get("easiest")!.tiebreakers, [{ scheme: "priority", direction: "asc" }]);
    assert.deepEqual(byId.get("matters")!.tiebreakers, [
      { scheme: "priority", direction: "asc" },
      { scheme: "when", direction: "asc" },
    ]);
    assert.deepEqual(byId.get("ready")!.tiebreakers, [{ scheme: "effort", direction: "asc" }]);
    assert.deepEqual(byId.get("looking-ahead")!.tiebreakers, [
      { scheme: "priority", direction: "asc" },
    ]);
    assert.deepEqual(byId.get("payoff")!.tiebreakers, [{ scheme: "effort", direction: "asc" }]);
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

  it("synthesizes legacy nnl/priority with scheme order + priority tiebreaker", () => {
    for (const key of ["nnl", "priority"]) {
      const { lens, synthesized } = resolveLens(key, SCHEMES);
      assert.equal(synthesized, true);
      assert.deepEqual(lens.columnOrder, SCHEMES.find((s) => s.key === key)!.options);
      assert.equal(lens.name, SCHEMES.find((s) => s.key === key)!.label);
      assert.deepEqual(lens.tiebreakers, [{ scheme: "priority", direction: "asc" }]);
    }
  });

  it("falls back to the term lens for unknown keys", () => {
    assert.equal(resolveLens("nope", SCHEMES).lens.id, "looking-ahead");
  });
});

describe("compareByTiebreakers", () => {
  const rankOf = (scheme: string, ideaId: string): number | null => {
    const table: Record<string, Record<string, number>> = {
      priority: { a: 0, b: 1 },
      nnl: { a: 1, b: 0 },
    };
    return table[scheme]?.[ideaId] ?? null;
  };
  const sortOrderOf = (ideaId: string): number => ({ a: 2, b: 1, c: 0 })[ideaId] ?? 9;

  it("orders asc by scheme rank", () => {
    const cmp = (x: string, y: string) =>
      compareByTiebreakers([{ scheme: "priority", direction: "asc" }], rankOf, sortOrderOf, x, y);
    assert.ok(cmp("a", "b") < 0);
    assert.ok(cmp("b", "a") > 0);
  });

  it("orders desc by reversed scheme rank", () => {
    const cmp = (x: string, y: string) =>
      compareByTiebreakers([{ scheme: "priority", direction: "desc" }], rankOf, sortOrderOf, x, y);
    assert.ok(cmp("a", "b") > 0);
    assert.ok(cmp("b", "a") < 0);
  });

  it("sorts unvalued last regardless of direction", () => {
    for (const direction of ["asc", "desc"] as const) {
      const cmp = (x: string, y: string) =>
        compareByTiebreakers([{ scheme: "priority", direction }], rankOf, sortOrderOf, x, y);
      assert.ok(cmp("a", "c") < 0, direction);
      assert.ok(cmp("c", "a") > 0, direction);
    }
  });

  it("falls through tiebreakers then sort_order", () => {
    // a and b tie on nnl? No: nnl a=1, b=0 -> b first. Use unknown scheme first.
    const cmp = (x: string, y: string) =>
      compareByTiebreakers(
        [
          { scheme: "missing", direction: "asc" },
          { scheme: "priority", direction: "asc" },
        ],
        rankOf,
        sortOrderOf,
        x,
        y,
      );
    assert.ok(cmp("a", "b") < 0);
    // Both unvalued in every tiebreaker -> sort_order fallback (c=0 before b=1).
    const bothNull = () => null;
    assert.ok(
      compareByTiebreakers(
        [{ scheme: "priority", direction: "asc" }],
        bothNull,
        sortOrderOf,
        "c",
        "b",
      ) < 0,
    );
  });
});

describe("buildLensComparator", () => {
  it("ranks by scheme option order with unvalued last and sort_order fallback", () => {
    const lens = DEFAULT_LENSES.find((l) => l.id === "easiest")!;
    const order = new Map([["priority", ["high", "medium", "low"]]]);
    const values: Record<string, string | null> = { a: "low", b: null, c: "high" };
    const cmp = buildLensComparator(
      lens,
      order,
      (id) => values[id] ?? null,
      () => 0,
    );
    assert.deepEqual(["a", "b", "c"].sort(cmp), ["c", "a", "b"]);
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
