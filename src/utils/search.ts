import Fuse from "fuse.js";

import { SingleBundle, SingleBundleCodec } from "./schema";
import { fuseOptions } from "./constants";

export interface GroupedBundles {
  pinned: SingleBundle[];
  unpinned: SingleBundle[];
  all: SingleBundle[];
}

export function groupBundles(bundles: SingleBundle[], searchText: string): GroupedBundles {
  const serializedBundles = bundles.map((item) => SingleBundleCodec.decode(item));
  const fuse = new Fuse(serializedBundles, fuseOptions);

  const all =
    searchText.length > 0 ? fuse.search(searchText).map(({ item }) => SingleBundleCodec.encode(item)) : bundles;

  return {
    pinned: all.filter((item) => item.pinned),
    unpinned: all.filter((item) => !item.pinned),
    all,
  };
}
