import { describe, it, expect, vi, beforeEach } from "vitest";

import type { SingleBundle } from "./schema";

const mocks = vi.hoisted(() => {
  const store = new Map<string, unknown>();

  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? undefined),
    setItem: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return true;
    }),
  };
});

vi.mock("@raycast/api", () => ({
  LocalStorage: {
    getItem: mocks.getItem,
    setItem: mocks.setItem,
  },
}));

vi.mock("./constants", () => ({
  BUNDLE_KEY: "bundle_all",
  fuseOptions: {},
  IGNORE_PIN_THRESHOLD: 3,
}));

const data = await import("./data");

const KEY = "bundle_all";

function bundle(name: string, lastUpdated: number, extra: Partial<SingleBundle> = {}): SingleBundle {
  return { name, description: "", urls: [`https://${name.toLowerCase()}.com`], lastUpdated, ...extra };
}

function seed(list: SingleBundle[]) {
  mocks.store.set(KEY, JSON.stringify(list));
}

function read(): SingleBundle[] {
  return JSON.parse(mocks.store.get(KEY) as string) as SingleBundle[];
}

describe("getBundles", () => {
  beforeEach(() => {
    mocks.store.clear();
    mocks.getItem.mockClear();
    mocks.setItem.mockClear();
  });

  it("reads from the bundle_all key", async () => {
    seed([]);
    await data.getBundles();

    expect(mocks.getItem).toHaveBeenCalledWith("bundle_all");
  });

  it("returns an empty list when nothing is stored", async () => {
    expect(await data.getBundles()).toEqual([]);
  });

  it("parses the stored json string into bundles", async () => {
    const stored = [bundle("A", 1)];
    seed(stored);

    expect(await data.getBundles()).toEqual(stored);
  });

  it("rejects a payload that violates the storage schema", async () => {
    mocks.store.set(KEY, JSON.stringify([{ name: "", description: "", urls: [], lastUpdated: 1 }]));

    await expect(data.getBundles()).rejects.toThrow();
  });
});

describe("onSubmitBundle", () => {
  beforeEach(() => {
    mocks.store.clear();
    vi.useRealTimers();
  });

  it("stamps lastUpdated with the current time on add", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(5_000));
    seed([]);

    await data.onSubmitBundle("ADD", bundle("A", 0));

    expect(read()).toEqual([bundle("A", 5_000)]);
  });

  it("keeps the passed lastUpdated when the override is disabled", async () => {
    seed([]);

    await data.onSubmitBundle("ADD", bundle("A", 123), undefined, false);

    expect(read()[0].lastUpdated).toBe(123);
  });

  it("sorts the stored list by lastUpdated descending", async () => {
    seed([bundle("Old", 10), bundle("Mid", 20)]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(30));

    await data.onSubmitBundle("ADD", bundle("New", 0));

    expect(read().map((item) => item.name)).toEqual(["New", "Mid", "Old"]);
  });

  it("writes the list back as a json string under bundle_all", async () => {
    seed([]);

    await data.onSubmitBundle("ADD", bundle("A", 1));

    expect(mocks.setItem).toHaveBeenCalledWith("bundle_all", expect.any(String));
    expect(typeof mocks.store.get(KEY)).toBe("string");
  });

  it("rejects a duplicate name before writing", async () => {
    seed([bundle("A", 1)]);

    await expect(data.onSubmitBundle("ADD", bundle("A", 2))).rejects.toThrow("Bundle already exist");

    expect(mocks.setItem).not.toHaveBeenCalled();
  });

  it("replaces the matching bundle on edit and keeps its position by name", async () => {
    seed([bundle("A", 10), bundle("B", 20)]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(15));

    await data.onSubmitBundle("EDIT", bundle("A", 0, { description: "changed" }), "A");

    const list = read();
    expect(list.map((item) => item.name)).toEqual(["B", "A"]);
    expect(list.find((item) => item.name === "A")).toMatchObject({ description: "changed", lastUpdated: 15 });
  });

  it("allows renaming a bundle on edit", async () => {
    seed([bundle("A", 10)]);

    await data.onSubmitBundle("EDIT", bundle("Renamed", 0), "A", false);

    expect(read()).toEqual([bundle("Renamed", 0)]);
  });

  it("rejects a rename that collides with another bundle", async () => {
    seed([bundle("A", 10), bundle("B", 20)]);

    await expect(data.onSubmitBundle("EDIT", bundle("B", 0), "A", false)).rejects.toThrow("Bundle already exist");
  });

  it("throws without a previous name on edit", async () => {
    seed([bundle("A", 10)]);

    await expect(data.onSubmitBundle("EDIT", bundle("A", 0))).rejects.toBe("something went wrong");
  });
});

describe("deleteBundle", () => {
  beforeEach(() => mocks.store.clear());

  it("removes only the named bundle", async () => {
    seed([bundle("A", 10), bundle("B", 20)]);

    await data.deleteBundle("A");

    expect(read().map((item) => item.name)).toEqual(["B"]);
  });

  it("is a no-op for an unknown name", async () => {
    seed([bundle("A", 10)]);

    await data.deleteBundle("Missing");

    expect(read()).toHaveLength(1);
  });
});

describe("pinBundle", () => {
  beforeEach(() => mocks.store.clear());

  it("sets pinned and moves the bundle to the top", async () => {
    seed([bundle("A", 10), bundle("B", 20)]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(30));

    await data.pinBundle("A");

    const list = read();
    expect(list[0]).toMatchObject({ name: "A", pinned: true });
    expect(list.map((item) => item.name)).toEqual(["A", "B"]);
  });

  it("unpins with pinned false", async () => {
    seed([bundle("A", 10, { pinned: true })]);

    await data.pinBundle("A", false);

    expect(read()[0].pinned).toBe(false);
  });

  it("throws for an unknown bundle", async () => {
    seed([bundle("A", 10)]);

    await expect(data.pinBundle("Missing")).rejects.toBe("no bundle found");
  });
});

describe("moveTop", () => {
  beforeEach(() => mocks.store.clear());

  it("moves the named bundle to the first position", async () => {
    seed([bundle("A", 30), bundle("B", 20), bundle("C", 10)]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(40));

    await data.moveTop("C");

    expect(read().map((item) => item.name)).toEqual(["C", "A", "B"]);
  });

  it("throws for an unknown bundle", async () => {
    seed([bundle("A", 10)]);

    await expect(data.moveTop("Missing")).rejects.toBe("Bundle not found");
  });
});

describe("moveBottom", () => {
  beforeEach(() => mocks.store.clear());

  it("places the bundle after the current bottom by subtracting 1000ms", async () => {
    seed([bundle("A", 30), bundle("B", 20)]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(100_000));

    await data.moveBottom("A");

    const list = read();
    expect(list.map((item) => item.name)).toEqual(["B", "A"]);
    expect(list[1].lastUpdated).toBe(20 - 1000);
  });

  it("throws for an unknown bundle", async () => {
    seed([bundle("A", 10)]);

    await expect(data.moveBottom("Missing")).rejects.toBe("Bundle not found");
  });

  it("throws when the store is empty", async () => {
    seed([]);

    await expect(data.moveBottom("Missing")).rejects.toBe("Bundle not found");
  });
});
