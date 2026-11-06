import { describe, it, expect, vi } from "vitest";

vi.mock("@raycast/api", () => ({
  getPreferenceValues: () => ({ ignore_pin_threshold: "4" }),
  openExtensionPreferences: vi.fn(),
  showHUD: vi.fn(),
}));

import { SingleBundleCodec, type SingleBundle } from "./schema";
import { fuseOptions } from "./constants";
import { groupBundles } from "./search";

function bundle(name: string, extra: Partial<SingleBundle> = {}): SingleBundle {
  return { name, description: "", urls: [`https://${name.toLowerCase()}.com`], lastUpdated: 1, ...extra };
}

const bundles = [
  bundle("Pinned Notes", { pinned: true }),
  bundle("Books"),
  bundle("Recipes", { description: "food and cooking" }),
];

function names(list: SingleBundle[]): string[] {
  return list.map((item) => item.name);
}

describe("groupBundles with an empty query", () => {
  it("returns everything in storage order", () => {
    expect(names(groupBundles(bundles, "").all)).toEqual(["Pinned Notes", "Books", "Recipes"]);
  });

  it("returns the same object references", () => {
    expect(groupBundles(bundles, "").all[0]).toBe(bundles[0]);
  });

  it("partitions pinned before unpinned", () => {
    const result = groupBundles(bundles, "");

    expect(names(result.pinned)).toEqual(["Pinned Notes"]);
    expect(names(result.unpinned)).toEqual(["Books", "Recipes"]);
  });
});

describe("groupBundles with a query", () => {
  it("filters out non matching bundles", () => {
    expect(names(groupBundles(bundles, "recipes").all)).toEqual(["Recipes"]);
  });

  it("matches names case insensitively", () => {
    expect(names(groupBundles(bundles, "BOOKS").all)).toContain("Books");
  });

  it("matches on description", () => {
    expect(names(groupBundles(bundles, "cooking").all)).toContain("Recipes");
  });

  it("matches on urls", () => {
    expect(names(groupBundles(bundles, "books.com").all)).toContain("Books");
  });

  it("encodes fuse results back into storage shape", () => {
    const [first] = groupBundles(bundles, "recipes").all;

    expect(Array.isArray(first.urls)).toBe(true);
    expect(typeof first.lastUpdated).toBe("number");
  });

  it("keeps pinned matches in the pinned bucket", () => {
    const result = groupBundles(bundles, "o");

    expect(result.pinned.every((item) => item.pinned)).toBe(true);
    expect(result.unpinned.every((item) => !item.pinned)).toBe(true);
  });

  it("returns empty buckets when nothing matches", () => {
    const result = groupBundles(bundles, "zzzz");

    expect(result.all).toEqual([]);
    expect(result.pinned).toEqual([]);
    expect(result.unpinned).toEqual([]);
  });
});

describe("fuse configuration used for grouping", () => {
  it("weights name above description above urls", () => {
    const weights = Object.fromEntries(fuseOptions.keys.map((key) => [key.name, key.weight])) as Record<string, number>;

    expect(weights.name).toBeGreaterThan(weights.description);
    expect(weights.description).toBeGreaterThan(weights.urls);
  });

  it("is case insensitive and sorted", () => {
    expect(fuseOptions.isCaseSensitive).toBe(false);
    expect(fuseOptions.shouldSort).toBe(true);
  });
});

describe("codec round trip used by search", () => {
  it("preserves the bundle through the serialized search form", () => {
    const decoded = SingleBundleCodec.decode(bundles[2]);

    expect(SingleBundleCodec.encode(decoded)).toEqual(bundles[2]);
  });
});
