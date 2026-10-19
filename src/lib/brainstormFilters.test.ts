import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BRAINSTORM_FILTERS,
  countActiveBrainstormFilters,
  loadBrainstormFilters,
} from "@/lib/brainstormFilters";
import { STORAGE_KEYS } from "@/lib/storage";

function withLocalStorage(values: Record<string, string>, fn: () => void) {
  const store = new Map(Object.entries(values));
  const g = globalThis as Record<string, unknown>;
  const prev = g.window;
  g.window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  try {
    fn();
  } finally {
    if (prev === undefined) delete g.window;
    else g.window = prev;
  }
}

describe("loadBrainstormFilters", () => {
  it("returns defaults when storage is empty", () => {
    withLocalStorage({}, () => {
      assert.deepEqual(loadBrainstormFilters(), DEFAULT_BRAINSTORM_FILTERS);
    });
  });

  it("loads persisted filters and rejects invalid values", () => {
    withLocalStorage(
      {
        [STORAGE_KEYS.brainstormFilters]: JSON.stringify({
          showToday: true,
          hideCompleted: true,
          typeFilter: ["task", "bogus"],
          timeScope: "bogus",
          showType: "yes",
        }),
      },
      () => {
        const f = loadBrainstormFilters();
        assert.equal(f.showToday, true);
        assert.equal(f.hideCompleted, true);
        assert.deepEqual(f.typeFilter, ["task"]);
        assert.equal(f.timeScope, "this_month");
        assert.equal(f.showType, true);
      },
    );
  });

  it("migrates legacy hideInHorizon key", () => {
    withLocalStorage({ [STORAGE_KEYS.brainstormHideInHorizon]: "true" }, () => {
      assert.equal(loadBrainstormFilters().hideInHorizon, true);
    });
  });

  it("new key wins over legacy key", () => {
    withLocalStorage(
      {
        [STORAGE_KEYS.brainstormFilters]: JSON.stringify({ hideInHorizon: false }),
        [STORAGE_KEYS.brainstormHideInHorizon]: "true",
      },
      () => {
        assert.equal(loadBrainstormFilters().hideInHorizon, false);
      },
    );
  });
});

describe("countActiveBrainstormFilters", () => {
  it("counts defaults as zero", () => {
    assert.equal(countActiveBrainstormFilters(DEFAULT_BRAINSTORM_FILTERS), 0);
  });

  it("counts each active filter group once", () => {
    assert.equal(
      countActiveBrainstormFilters({
        ...DEFAULT_BRAINSTORM_FILTERS,
        showToday: true,
        hideClosed: true,
        typeFilter: ["task", "project"],
        showType: false,
      }),
      4,
    );
  });
});
