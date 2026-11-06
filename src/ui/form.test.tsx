import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { ZodError } from "zod";

import { actionElements, flush, hostByProp, invoke, renderWithHooks } from "./testUtils";

const mocks = vi.hoisted(() => ({
  pop: vi.fn(),
  showToast: vi.fn(async () => undefined),
  onSubmitBundle: vi.fn(async () => undefined),
}));

vi.mock("@raycast/api", () => {
  const Form = Object.assign((_props: Record<string, unknown>) => createElement("form", _props), {
    TextField: (props: Record<string, unknown>) => createElement("textfield", props),
    TextArea: (props: Record<string, unknown>) => createElement("textarea", props),
  });

  return {
    Form,
    ActionPanel: (props: Record<string, unknown>) => createElement("panel", props),
    Action: Object.assign((props: Record<string, unknown>) => createElement("action", props), {
      SubmitForm: (props: Record<string, unknown>) => createElement("submit", props),
    }),
    showToast: mocks.showToast,
    useNavigation: () => ({ pop: mocks.pop }),
  };
});

vi.mock("../utils/data", () => ({ onSubmitBundle: mocks.onSubmitBundle }));

const { default: BundlerForm } = await import("./form");

const defaults = { name: "Dev", description: "daily drivers", urls: "https://a.com\nhttps://b.com" };

async function render(mode: "ADD" | "EDIT", formDefaults?: typeof defaults) {
  return renderWithHooks(createElement(BundlerForm, { mode, defaults: formDefaults }));
}

async function submit(root: Awaited<ReturnType<typeof render>>["root"], state: Record<string, unknown>) {
  const submitAction = actionElements(root, "Save");
  if (!submitAction) throw new Error("no save action");
  await invoke(() => (submitAction.props.onSubmit as (values: unknown) => unknown)(state));
  await flush();
}

describe("BundlerForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onSubmitBundle.mockResolvedValue(undefined);
  });

  it("titles the ADD form", async () => {
    const { root } = await render("ADD");

    expect(hostByProp(root, { navigationTitle: "Add Links Bundler" })).toHaveLength(1);
  });

  it("titles the EDIT form", async () => {
    const { root } = await render("EDIT", defaults);

    expect(hostByProp(root, { navigationTitle: "Edit Links Bundler" })).toHaveLength(1);
  });

  it("renders name, description and urls fields with defaults", async () => {
    const { root } = await render("EDIT", defaults);

    expect(hostByProp(root, { id: "name" })[0].props.defaultValue).toBe("Dev");
    expect(hostByProp(root, { id: "description" })[0].props.defaultValue).toBe("daily drivers");
    expect(hostByProp(root, { id: "urls" })[0].props.defaultValue).toBe("https://a.com\nhttps://b.com");
  });

  it("offers a save action", async () => {
    const { root } = await render("ADD");

    expect(actionElements(root, "Save")).toBeTruthy();
  });

  it("submits the encoded bundle in ADD mode with no previous name", async () => {
    const { root } = await render("ADD");
    await submit(root, { name: "New", description: "d", urls: "https://x.com" });

    expect(mocks.onSubmitBundle).toHaveBeenCalledWith(
      "ADD",
      { name: "New", description: "d", urls: ["https://x.com"], lastUpdated: 0 },
      undefined,
    );
  });

  it("passes the defaults name as the previous name in EDIT mode", async () => {
    const { root } = await render("EDIT", defaults);
    await submit(root, { name: "Renamed", description: "d", urls: "https://x.com" });

    expect(mocks.onSubmitBundle).toHaveBeenCalledWith(
      "EDIT",
      { name: "Renamed", description: "d", urls: ["https://x.com"], lastUpdated: 0 },
      "Dev",
    );
  });

  it("toasts with the mode, name and url count then pops", async () => {
    const { root } = await render("ADD");
    await submit(root, { name: "New", description: "d", urls: "https://a.com\nhttps://b.com" });

    expect(mocks.showToast).toHaveBeenCalledWith({
      title: "ADD",
      message: "New added with 2 items",
    });
    expect(mocks.pop).toHaveBeenCalledTimes(1);
  });

  it("does not pop or toast when saving fails with a zod error", async () => {
    mocks.onSubmitBundle.mockRejectedValueOnce(new ZodError([]));
    const { root } = await render("ADD");

    await submit(root, { name: "New", description: "d", urls: "https://a.com" });

    expect(mocks.pop).not.toHaveBeenCalled();
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it("rejects from the catch handler for a non zod rejection", async () => {
    mocks.onSubmitBundle.mockRejectedValueOnce("something went wrong");
    const { root } = await render("EDIT", defaults);
    const submitAction = actionElements(root, "Save");
    if (!submitAction) throw new Error("no save action");

    const onSubmit = submitAction.props.onSubmit as (values: unknown) => Promise<unknown>;
    await expect(onSubmit({ name: "Dev", description: "", urls: "https://a.com" })).rejects.toBeInstanceOf(TypeError);
    expect(mocks.pop).not.toHaveBeenCalled();
  });

  it("maps zod issues to per field errors", async () => {
    const error = new ZodError([
      { code: "custom", message: "Bundle already exist, please use another name.", path: ["name"] },
    ]);
    mocks.onSubmitBundle.mockRejectedValueOnce(error);

    const { root } = await render("ADD");
    await submit(root, { name: "Dup", description: "d", urls: "https://a.com" });

    expect(hostByProp(root, { id: "name" })[0].props.error).toBe("Bundle already exist, please use another name.");
  });

  it("clears the name error when the name field changes", async () => {
    const error = new ZodError([{ code: "custom", message: "taken", path: ["name"] }]);
    mocks.onSubmitBundle.mockRejectedValueOnce(error);

    const { root } = await render("ADD");
    await submit(root, { name: "Dup", description: "d", urls: "https://a.com" });

    const nameField = hostByProp(root, { id: "name" })[0];
    await invoke(() => nameField.props.onChange());

    expect(hostByProp(root, { id: "name" })[0].props.error).toBe("");
  });

  it("shows a generic urls error when the urls issue is reported", async () => {
    const error = new ZodError([{ code: "custom", message: "Too small", path: ["urls"] }]);
    mocks.onSubmitBundle.mockRejectedValueOnce(error);

    const { root } = await render("ADD");
    await submit(root, { name: "New", description: "d", urls: "" });

    expect(hostByProp(root, { id: "urls" })[0].props.error).toBe("Error: should be a list of URLs");
  });
});
