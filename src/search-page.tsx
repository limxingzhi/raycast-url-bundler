import { useEffect, useState, useMemo } from "react";
import { List } from "@raycast/api";

import { SingleBundle } from "./utils/schema";
import { getBundles } from "./utils/data";
import { IGNORE_PIN_THRESHOLD } from "./utils/constants";
import { groupBundles } from "./utils/search";
import { resolveSelection, type SelectionState } from "./utils/selection";
import ListEntry from "./ui/listEntry";

export default function SearchPage() {
  const [searchText, setSearchText] = useState("");
  const [bundles, setBundles] = useState<Array<SingleBundle>>([]);

  // filter items against search text and split them into pinned and unpinned buckets
  const filteredBundles = useMemo(() => groupBundles(bundles, searchText), [bundles, searchText]);

  // index to reset the list after an action
  const [listKey, setListKey] = useState(0);
  const refreshList = () => setListKey((val) => val + 1);

  useEffect(() => {
    getBundles().then(setBundles);
  }, [listKey]);

  const ignorePins = searchText.length > IGNORE_PIN_THRESHOLD;

  const [selection, setSelection] = useState<SelectionState>({ query: searchText, id: undefined });

  const displayedBundles = ignorePins ? filteredBundles.all : [...filteredBundles.pinned, ...filteredBundles.unpinned];
  const selectedItemId = resolveSelection(
    selection,
    searchText,
    displayedBundles.map((item) => item.name),
  );
  const onSelectionChange = (id: string | null) => setSelection({ query: searchText, id: id ?? undefined });

  if (ignorePins) {
    // render unpinned list
    return (
      <List
        searchText={searchText}
        onSearchTextChange={setSearchText}
        selectedItemId={selectedItemId}
        onSelectionChange={onSelectionChange}
        navigationTitle="Fuzzy search bundles"
      >
        {filteredBundles.all.map((item, index) => (
          <ListEntry
            key={item.name}
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
      <List
        searchText={searchText}
        onSearchTextChange={setSearchText}
        selectedItemId={selectedItemId}
        onSelectionChange={onSelectionChange}
        navigationTitle="Fuzzy search bundles"
      >
        <List.Section title="Pinned Bundles" subtitle={`${filteredBundles.pinned.length} items`}>
          {filteredBundles.pinned.map((item, index) => (
            <ListEntry
              key={item.name}
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
              key={item.name}
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
