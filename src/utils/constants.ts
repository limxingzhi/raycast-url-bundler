export const BUNDLE_KEY = "bundle_all";

// https://www.fusejs.io/concepts/scoring-theory.html
export const fuseOptions = {
  isCaseSensitive: true,
  shouldSort: true,
  fieldNormWeight: 1,
  keys: [
    { name: "name", weight: 0.7 },
    { name: "urls", weight: 0.1 },
    { name: "description", weight: 0.2 },
  ],
};

