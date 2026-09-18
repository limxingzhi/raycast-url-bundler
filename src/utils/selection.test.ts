import { describe, it, expect } from "vitest";

import { resolveSelection } from "./selection";

describe("resolveSelection", () => {
  it("selects the first result when the query changes", () => {
    const state = { query: "pin", id: "Books" };

    expect(resolveSelection(state, "pinned", ["Notes", "Books"])).toBe("Notes");
  });

  it("keeps an explicit selection while the query is unchanged", () => {
    const state = { query: "pin", id: "Books" };

    expect(resolveSelection(state, "pin", ["Notes", "Books"])).toBe("Books");
  });

  it("falls back to the first result when the selected item is filtered out", () => {
    const state = { query: "pin", id: "Books" };

    expect(resolveSelection(state, "pin", ["Notes", "Recipes"])).toBe("Notes");
  });

  it("re-selects the first result when typing reorders the matches", () => {
    const state = { query: "bo", id: "Books" };

    expect(resolveSelection(state, "boo", ["Bookmarks", "Books"])).toBe("Bookmarks");
  });

  it("selects nothing when there are no results", () => {
    expect(resolveSelection({ query: "x", id: "Books" }, "xy", [])).toBeUndefined();
  });
});
