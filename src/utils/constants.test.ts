import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getPreferenceValues: vi.fn(),
  showHUD: vi.fn(),
  openExtensionPreferences: vi.fn(),
}));

vi.mock("@raycast/api", () => ({
  getPreferenceValues: mocks.getPreferenceValues,
  showHUD: mocks.showHUD,
  openExtensionPreferences: mocks.openExtensionPreferences,
}));

async function loadConstants() {
  vi.resetModules();
  return import("./constants");
}

describe("constants", () => {
  beforeEach(() => {
    mocks.getPreferenceValues.mockReset();
    mocks.showHUD.mockReset();
    mocks.openExtensionPreferences.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the storage key stable", async () => {
    mocks.getPreferenceValues.mockReturnValue({ ignore_pin_threshold: "4" });
    const { BUNDLE_KEY } = await loadConstants();

    expect(BUNDLE_KEY).toBe("bundle_all");
  });

  it("stores the threshold as the preference value minus one", async () => {
    mocks.getPreferenceValues.mockReturnValue({ ignore_pin_threshold: "4" });
    const { IGNORE_PIN_THRESHOLD } = await loadConstants();

    expect(IGNORE_PIN_THRESHOLD).toBe(3);
    expect(mocks.showHUD).not.toHaveBeenCalled();
  });

  it("inherits the preference object read at module load", async () => {
    mocks.getPreferenceValues.mockReturnValue({ ignore_pin_threshold: "10" });
    const { IGNORE_PIN_THRESHOLD } = await loadConstants();

    expect(IGNORE_PIN_THRESHOLD).toBe(9);
    expect(mocks.getPreferenceValues).toHaveBeenCalledTimes(1);
  });

  it("parses a partial numeric string the way parseInt does", async () => {
    mocks.getPreferenceValues.mockReturnValue({ ignore_pin_threshold: "7px" });
    const { IGNORE_PIN_THRESHOLD } = await loadConstants();

    expect(IGNORE_PIN_THRESHOLD).toBe(6);
  });

  it("falls back to 3, shows a HUD and opens preferences for a non numeric value", async () => {
    mocks.getPreferenceValues.mockReturnValue({ ignore_pin_threshold: "abc" });
    const { IGNORE_PIN_THRESHOLD } = await loadConstants();

    expect(IGNORE_PIN_THRESHOLD).toBe(3);
    expect(mocks.showHUD).toHaveBeenCalledWith("ERROR: Threshold must be a number");
    expect(mocks.openExtensionPreferences).toHaveBeenCalledTimes(1);
  });

  it("falls back when the preference key is missing", async () => {
    mocks.getPreferenceValues.mockReturnValue({});
    const { IGNORE_PIN_THRESHOLD } = await loadConstants();

    expect(IGNORE_PIN_THRESHOLD).toBe(3);
    expect(mocks.showHUD).toHaveBeenCalledTimes(1);
  });

  it("keeps the fuse field weights", async () => {
    mocks.getPreferenceValues.mockReturnValue({ ignore_pin_threshold: "4" });
    const { fuseOptions } = await loadConstants();

    expect(fuseOptions).toMatchObject({
      isCaseSensitive: false,
      shouldSort: true,
      fieldNormWeight: 1,
      keys: [
        { name: "name", weight: 0.7 },
        { name: "urls", weight: 0.1 },
        { name: "description", weight: 0.2 },
      ],
    });
  });
});
