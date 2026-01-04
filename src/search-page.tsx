import { useEffect, useState, useMemo } from "react";
import { List } from "@raycast/api";
import Fuse from "fuse.js";

import { SingleBundle, SingleBundleCodec } from "./utils/schema";
import { getBundles } from "./utils/data";
import { fuseOptions, IGNORE_PIN_THRESHOLD } from "./utils/constants";
import ListEntry from "./ui/listEntry";

export default function SearchPage() {
  const [searchText, setSearchText] = useState("");
  const [bundles, setBundles] = useState<Array<SingleBundle>>([]);

  // seralize all bundles for easy searching
  const serializedBundles = useMemo(() => {
    return bundles.map((item) => SingleBundleCodec.decode(item));
  }, [bundles]);

  // configure fuse with serlized urls
  const fuse = useMemo(() => new Fuse(serializedBundles, fuseOptions), [serializedBundles]);

  // filter items against search text and parse back into usable object
  const filteredBundles = useMemo(() => {
    const all =
      searchText.length > 0 ? fuse.search(searchText).map(({ item }) => SingleBundleCodec.encode(item)) : bundles;

    const pinnedItems = all.filter((item) => item.pinned);
    const unpinnedItems = all.filter((item) => !item.pinned);

    return { pinned: pinnedItems, unpinned: unpinnedItems, all };
  }, [fuse, searchText]);

  // index to reset the list after an action
  const [listKey, setListKey] = useState(0);
  const refreshList = () => setListKey((val) => val + 1);

  useEffect(() => {
    getBundles().then(setBundles);
  }, [listKey]);

  if (searchText.length > IGNORE_PIN_THRESHOLD) {
    // render unpinned list
    return (
      <List searchText={searchText} onSearchTextChange={setSearchText} navigationTitle="Fuzzy search bundles">
        {filteredBundles.all.map((item, index) => (
          <ListEntry
            key={item.name + "_index"}
            item={item}
            index={index}
            refreshCallback={refreshList}
            listLength={filteredBundles.all.length}
          />
        ))}
      </List>
    );
  } else {
    // render pinned list with sections
    return (
      <List searchText={searchText} onSearchTextChange={setSearchText} navigationTitle="Fuzzy search bundles">
        <List.Section title="Pinned Bundles" subtitle={`${filteredBundles.pinned.length} items`}>
          {filteredBundles.pinned.map((item, index) => (
            <ListEntry
              key={item.name + "_index"}
              item={item}
              index={index}
              refreshCallback={refreshList}
              listLength={filteredBundles.pinned.length}
            />
          ))}
        </List.Section>
        <List.Section title="Bundles" subtitle={`${filteredBundles.unpinned.length} items`}>
          {filteredBundles.unpinned.map((item, index) => (
            <ListEntry
              key={item.name + "_index"}
              item={item}
              index={index}
              refreshCallback={refreshList}
              listLength={filteredBundles.unpinned.length}
            />
          ))}
        </List.Section>
      </List>
    );
  }
}
