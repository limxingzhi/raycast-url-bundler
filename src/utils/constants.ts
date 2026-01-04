import { getPreferenceValues, openExtensionPreferences, showHUD } from "@raycast/api";

export const BUNDLE_KEY = "bundle_all";

export const IGNORE_PIN_THRESHOLD: number = (() => {
  const result = parseInt(getPreferenceValues()["ignore_pin_threshold"], 10);
  if (isNaN(result)) {
    showHUD("ERROR: Threshold must be a number");
    openExtensionPreferences();
    return 4-1;
  }

  return result - 1;
})();

// https://www.fusejs.io/concepts/scoring-theory.html
export const fuseOptions = {
  isCaseSensitive: false,
  shouldSort: true,
  fieldNormWeight: 1,
  keys: [
    { name: "name", weight: 0.7 },
    { name: "urls", weight: 0.1 },
    { name: "description", weight: 0.2 },
  ],
};
