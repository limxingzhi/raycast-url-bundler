import { describe, it, expect } from "vitest";

import { BundleStoreSchema, FormInputSchema, SingleBundleCodec, SingleBundleSchema, type SingleBundle } from "./schema";

const storedBundle: SingleBundle = {
  name: "Dev",
  description: "daily drivers",
  urls: ["https://a.com", "https://b.com"],
  lastUpdated: 1700000000000,
};

describe("SingleBundleSchema", () => {
  it("accepts a bundle as written to storage", () => {
    expect(SingleBundleSchema.parse(storedBundle)).toEqual(storedBundle);
  });

  it("rejects an empty name", () => {
    expect(SingleBundleSchema.safeParse({ ...storedBundle, name: "" }).success).toBe(false);
  });

  it("rejects an empty url list", () => {
    expect(SingleBundleSchema.safeParse({ ...storedBundle, urls: [] }).success).toBe(false);
  });

  it("rejects an empty url entry", () => {
    expect(SingleBundleSchema.safeParse({ ...storedBundle, urls: ["https://a.com", ""] }).success).toBe(false);
  });

  it("rejects a missing lastUpdated", () => {
    const withoutTimestamp = { name: "Dev", description: "d", urls: ["https://a.com"] };
    expect(SingleBundleSchema.safeParse(withoutTimestamp).success).toBe(false);
  });

  it("treats pinned as optional and drops it when absent", () => {
    expect(SingleBundleSchema.parse(storedBundle)).not.toHaveProperty("pinned");
    expect(SingleBundleSchema.parse({ ...storedBundle, pinned: true }).pinned).toBe(true);
  });
});

describe("FormInputSchema", () => {
  it("accepts newline separated urls without a timestamp", () => {
    expect(FormInputSchema.safeParse({ name: "Dev", description: "", urls: "https://a.com" }).success).toBe(true);
  });

  it("accepts an arbitrary string for name so field errors render from save", () => {
    expect(FormInputSchema.safeParse({ name: "", description: "", urls: "" }).success).toBe(true);
  });
});

describe("SingleBundleCodec", () => {
  it("decode joins urls into a newline separated form value", () => {
    expect(SingleBundleCodec.decode(storedBundle)).toEqual({
      name: "Dev",
      description: "daily drivers",
      urls: "https://a.com\nhttps://b.com",
      lastUpdated: 1700000000000,
    });
  });

  it("encode splits urls and defaults lastUpdated to 0", () => {
    expect(SingleBundleCodec.encode({ name: "Dev", description: "d", urls: "https://a.com\nhttps://b.com" })).toEqual({
      name: "Dev",
      description: "d",
      urls: ["https://a.com", "https://b.com"],
      lastUpdated: 0,
    });
  });

  it("encode keeps a lastUpdated passed from the form", () => {
    expect(
      SingleBundleCodec.encode({ name: "Dev", description: "d", urls: "https://a.com", lastUpdated: 42 }).lastUpdated,
    ).toBe(42);
  });

  it("round trips storage -> form -> storage", () => {
    const decoded = SingleBundleCodec.decode(storedBundle);
    expect(SingleBundleCodec.encode(decoded)).toEqual(storedBundle);
  });

  it("keeps pinned across a round trip", () => {
    const pinned = { ...storedBundle, pinned: true };
    expect(SingleBundleCodec.encode(SingleBundleCodec.decode(pinned))).toEqual(pinned);
  });

  it("rejects a trailing newline because it yields an empty url", () => {
    expect(() => SingleBundleCodec.encode({ name: "Dev", description: "d", urls: "https://a.com\n" })).toThrow();

    const result = SingleBundleCodec.safeEncode({ name: "Dev", description: "d", urls: "https://a.com\n" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["urls", 1]);
  });

  it("rejects a form with empty urls", () => {
    expect(SingleBundleCodec.safeEncode({ name: "Dev", description: "d", urls: "" }).success).toBe(false);
  });
});

describe("BundleStoreSchema", () => {
  it("accepts a list of uniquely named bundles", () => {
    expect(BundleStoreSchema.safeParse([storedBundle, { ...storedBundle, name: "Other" }]).success).toBe(true);
  });

  it("reports the duplicate name message on the name path", () => {
    const result = BundleStoreSchema.safeParse([storedBundle, storedBundle]);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Bundle already exist, please use another name.");
    expect(result.error?.issues[0].path).toEqual(["name"]);
  });

  it("accepts the empty store", () => {
    expect(BundleStoreSchema.safeParse([]).success).toBe(true);
  });
});
