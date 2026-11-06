import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";

import type { SingleBundle } from "../utils/schema";
import { actionElements, actionTitles, byProp, flush, invoke, renderWithHooks } from "./testUtils";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  showToast: vi.fn(async () => undefined),
  open: vi.fn(),
  deleteBundle: vi.fn(async () => undefined),
  pinBundle: vi.fn(async () => undefined),
  moveTop: vi.fn(async () => undefined),
  moveBottom: vi.fn(async () => undefined),
}));

vi.mock("@raycast/api", () => {
  const Action = Object.assign((props: Record<string, unknown>) => createElement("action", props), {
    Style: { Regular: "regular", Destructive: "destructive" },
    CopyToClipboard: "copy",
  });

  return {
    List: { Item: (props: Record<string, unknown>) => createElement("item", props), Section: "section" },
    ActionPanel: Object.assign((props: Record<string, unknown>) => createElement("panel", props), {
      Section: "section",
      Submenu: (props: Record<string, unknown>) => createElement("submenu", props),
    }),
    Action,
    Icon: { Compass: "compass", Pencil: "pencil", Trash: "trash", Warning: "warning", Tack: "tack" },
    Keyboard: {
      Shortcut: {
        Common: {
          Copy: "copy-shortcut",
          Edit: "edit-shortcut",
          MoveDown: "move-down-shortcut",
          MoveUp: "move-up-shortcut",
          Pin: "pin-shortcut",
          Refresh: "refresh-shortcut",
          Remove: "remove-shortcut",
          RemoveAll: "remove-all-shortcut",
        },
      },
    },
    Color: { Red: "red" },
    open: mocks.open,
    showToast: mocks.showToast,
    useNavigation: () => ({ push: mocks.push }),
    Form: {},
  };
});

vi.mock("../utils/data", () => ({
  deleteBundle: mocks.deleteBundle,
  pinBundle: mocks.pinBundle,
  moveTop: mocks.moveTop,
  moveBottom: mocks.moveBottom,
}));

vi.mock("./form", () => ({ default: "form" }));

const { default: ListEntry } = await import("./listEntry");

const item: SingleBundle = {
  name: "Dev",
  description: "daily drivers",
  urls: ["https://a.com", "https://b.com"],
  lastUpdated: 1,
};

type Overrides = Partial<{ item: SingleBundle; index: number; listLength: number; refreshCallback: () => void }>;

async function render(overrides: Overrides = {}) {
  const { refreshCallback = vi.fn(), ...rest } = overrides;
  return renderWithHooks(createElement(ListEntry, { item, index: 0, listLength: 1, refreshCallback, ...rest }));
}

describe("ListEntry rendering", () => {
  it("uses the bundle name as the list item id", async () => {
    const { root } = await render();
    const row = byProp(root, { id: "Dev" })[0];

    expect(row.props.title).toBe("Dev");
    expect(row.props.subtitle).toBe("daily drivers");
  });

  it("shows the url count and a tack accessory only when pinned", async () => {
    const unpinned = await render();
    expect(byProp(unpinned.root, { id: "Dev" })[0].props.accessories[0]).toMatchObject({ text: "2", icon: undefined });

    const pinned = await render({ item: { ...item, pinned: true } });
    expect(byProp(pinned.root, { id: "Dev" })[0].props.accessories[0]).toMatchObject({ text: "2", icon: "tack" });
  });

  it("lists the core actions for every bundle", async () => {
    const titles = actionTitles((await render()).root);

    expect(titles).toContain("Open URLs");
    expect(titles).toContain("Edit Bundle");
    expect(titles).toContain("Delete Bundle");
  });
});

describe("ListEntry positioning actions", () => {
  it("hides both moves for a lone item", async () => {
    const titles = actionTitles((await render()).root);

    expect(titles).not.toContain("Move to Top");
    expect(titles).not.toContain("Move to Bottom");
  });

  it("offers both moves for a middle item", async () => {
    const titles = actionTitles((await render({ index: 1, listLength: 3 })).root);

    expect(titles).toContain("Move to Top");
    expect(titles).toContain("Move to Bottom");
  });

  it("offers only the move to bottom for the first of several items", async () => {
    const titles = actionTitles((await render({ index: 0, listLength: 2 })).root);

    expect(titles).not.toContain("Move to Top");
    expect(titles).toContain("Move to Bottom");
  });

  it("offers only the move to top for the last item", async () => {
    const titles = actionTitles((await render({ index: 1, listLength: 2 })).root);

    expect(titles).toContain("Move to Top");
    expect(titles).not.toContain("Move to Bottom");
  });
});

describe("ListEntry shortcuts", () => {
  it("uses the shared keyboard presets so they are not ambiguous across platforms", async () => {
    const { root } = await render({ index: 1, listLength: 3 });

    expect(actionElements(root, "Edit Bundle")?.props.shortcut).toBe("edit-shortcut");
    expect(actionElements(root, "Copy Bundle")?.props.shortcut).toBe("copy-shortcut");
    expect(actionElements(root, "Delete Bundle")?.props.shortcut).toBe("remove-shortcut");
    expect(actionElements(root, "Confirm Delete (This Is Irreversible)")?.props.shortcut).toBe("remove-all-shortcut");
    expect(actionElements(root, "Dismiss")?.props.shortcut).toBe("refresh-shortcut");
    expect(actionElements(root, "Pin Bundle")?.props.shortcut).toBe("pin-shortcut");
    expect(actionElements(root, "Move to Top")?.props.shortcut).toBe("move-up-shortcut");
    expect(actionElements(root, "Move to Bottom")?.props.shortcut).toBe("move-down-shortcut");
  });
});

describe("ListEntry pin action", () => {
  it("offers pin when unpinned and unpin when pinned", async () => {
    expect(actionTitles((await render()).root)).toContain("Pin Bundle");
    expect(actionTitles((await render({ item: { ...item, pinned: true } })).root)).toContain("Unpin Bundle");
  });
});

describe("ListEntry action handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  async function run(title: string, overrides: Overrides = {}) {
    const { root, unmount } = await render(overrides);
    const target = actionElements(root, title);
    if (!target) throw new Error(`no action titled ${title}`);
    await invoke(() => target.props.onAction && (target.props.onAction as () => unknown)());
    await flush();
    unmount();
  }

  it("opens every url in the bundle", async () => {
    await run("Open URLs");

    expect(mocks.open.mock.calls.map((call) => call[0])).toEqual(["https://a.com", "https://b.com"]);
  });

  it("deletes then toasts then refreshes", async () => {
    const refreshCallback = vi.fn();
    await run("Confirm Delete (This Is Irreversible)", { refreshCallback });

    expect(mocks.deleteBundle).toHaveBeenCalledWith("Dev");
    expect(mocks.showToast).toHaveBeenCalledWith({ title: "Dev deleted." });
    expect(refreshCallback).toHaveBeenCalledTimes(1);
  });

  it("pins then toasts then refreshes", async () => {
    const refreshCallback = vi.fn();
    await run("Pin Bundle", { refreshCallback });

    expect(mocks.pinBundle).toHaveBeenCalledWith("Dev");
    expect(mocks.showToast).toHaveBeenCalledWith({ title: "Dev pinned." });
    expect(refreshCallback).toHaveBeenCalledTimes(1);
  });

  it("unpins with pinned false", async () => {
    await run("Unpin Bundle", { item: { ...item, pinned: true } });

    expect(mocks.pinBundle).toHaveBeenCalledWith("Dev", false);
  });

  it("moves to top then refreshes", async () => {
    const refreshCallback = vi.fn();
    await run("Move to Top", { index: 1, listLength: 3, refreshCallback });

    expect(mocks.moveTop).toHaveBeenCalledWith("Dev");
    expect(refreshCallback).toHaveBeenCalledTimes(1);
  });

  it("moves to bottom then refreshes", async () => {
    const refreshCallback = vi.fn();
    await run("Move to Bottom", { index: 0, listLength: 3, refreshCallback });

    expect(mocks.moveBottom).toHaveBeenCalledWith("Dev");
    expect(refreshCallback).toHaveBeenCalledTimes(1);
  });

  it("pushes the edit form and refreshes when that form pops", async () => {
    const refreshCallback = vi.fn();
    await run("Edit Bundle", { refreshCallback });

    expect(mocks.push).toHaveBeenCalledTimes(1);
    const [form, onPop] = mocks.push.mock.calls[0] as [unknown, () => void];
    expect(form).toBeTruthy();
    onPop();
    expect(refreshCallback).toHaveBeenCalledTimes(1);
  });
});
