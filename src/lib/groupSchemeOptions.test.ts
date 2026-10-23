import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getGroupSchemeOptions } from "./groupSchemeOptions";

describe("getGroupSchemeOptions", () => {
  it("maps schemes to { key, label }", () => {
    const schemes = [
      {
        id: "s1",
        user_id: "u",
        key: "term",
        label: "Term",
        sort_order: 1,
        created_at: "0",
      },
      {
        id: "s2",
        user_id: "u",
        key: "nnl",
        label: "NNL",
        sort_order: 2,
        created_at: "0",
      },
    ];
    assert.deepEqual(getGroupSchemeOptions(schemes), [
      { key: "term", label: "Term" },
      { key: "nnl", label: "NNL" },
    ]);
  });

  it("sorts by sort_order and does not mutate the input", () => {
    const schemes = [
      {
        id: "s2",
        user_id: "u",
        key: "nnl",
        label: "NNL",
        sort_order: 2,
        created_at: "0",
      },
      {
        id: "s1",
        user_id: "u",
        key: "term",
        label: "Term",
        sort_order: 1,
        created_at: "0",
      },
    ];
    const originalOrder = schemes.map((s) => s.sort_order);
    const options = getGroupSchemeOptions(schemes);
    assert.deepEqual(options, [
      { key: "term", label: "Term" },
      { key: "nnl", label: "NNL" },
    ]);
    assert.deepEqual(originalOrder, [2, 1]);
  });

  it("returns an empty list for no schemes", () => {
    assert.deepEqual(getGroupSchemeOptions([]), []);
  });
});
