import { useEffect, useState, useMemo, ReactElement } from "react";
import { List, ActionPanel, Action, open, useNavigation, showToast, Icon } from "@raycast/api";
import Fuse from "fuse.js";

import { SingleBundle, SingleBundleCodec } from "./utils/schema";
import { deleteBundle, getBundles, pinBundle } from "./utils/data";
import BundlerForm from "./ui/form";
import { fuseOptions, IGNORE_PIN_THRESHOLD } from "./utils/constants";

const renderList = (
  item: SingleBundle,
  index: number,
  refreshCallback: () => void,
  push: (ui: ReactElement, callback: () => void) => void,
) => (
  <List.Item
    key={item.name + "_" + index}
    title={item.name}
    subtitle={item.description}
    accessories={[{ text: String(item.urls.length), icon: item.pinned ? Icon.Tack : undefined }]}
    actions={
      <ActionPanel>
        <Action title="Open URLs" onAction={() => item.urls.map((link) => open(link))} />
        <Action
          title="Edit Bundle"
          shortcut={{ modifiers: ["cmd"], key: "i" }}
          onAction={() => {
            push(<BundlerForm mode="EDIT" defaults={SingleBundleCodec.decode(item)} />, refreshCallback);
          }}
        />
        <Action
          title="Delete Bundle"
          onAction={() => {
            deleteBundle(item.name)
              .then(() =>
                showToast({
                  title: `${item.name} deleted.`,
                }),
              )
              .then(refreshCallback);
          }}
        />
        {item.pinned ? (
          <Action
            title="Unpin Bundle"
            shortcut={{ modifiers: ["cmd"], key: "m" }}
            onAction={() => {
              pinBundle(item.name, false)
                .then(() =>
                  showToast({
                    title: `${item.name} unpinned.`,
                  }),
                )
                .then(refreshCallback);
            }}
          />
        ) : (
          <Action
            title="Pin Bundle"
            shortcut={{ modifiers: ["cmd"], key: "m" }}
            onAction={() => {
              pinBundle(item.name)
                .then(() =>
                  showToast({
                    title: `${item.name} pinned.`,
                  }),
                )
                .then(refreshCallback);
            }}
          />
        )}
      </ActionPanel>
    }
  />
);

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

  const { push } = useNavigation();

  useEffect(() => {
    getBundles().then(setBundles);
  }, [listKey]);

  if (searchText.length > IGNORE_PIN_THRESHOLD) {
    // render unpinned list
    return (
      <List searchText={searchText} onSearchTextChange={setSearchText} navigationTitle="Fuzzy search bundles">
        {filteredBundles.all.map((item, index) => {
          return renderList(item, index, refreshList, push);
        })}
      </List>
    );
  } else {
    // render pinned list with sections
    return (
      <List searchText={searchText} onSearchTextChange={setSearchText} navigationTitle="Fuzzy search bundles">
        <List.Section title="Pinned Bundles">
          {filteredBundles.pinned.map((item, index) => {
            return renderList(item, index, refreshList, push);
          })}
        </List.Section>
        <List.Section title="Bundles">
          {filteredBundles.unpinned.map((item, index) => {
            return renderList(item, index, refreshList, push);
          })}
        </List.Section>
      </List>
    );
  }
}
