import { useEffect, useState, useMemo } from "react";
import { List, ActionPanel, Action, open, useNavigation, showToast } from "@raycast/api";
import Fuse from "fuse.js";

import { SingleBundle, SingleBundleCodec } from "./utils/schema";
import { deleteBundle, getBundles } from "./utils/data";
import BundlerForm from "./ui/form";
import { fuseOptions } from "./utils/constants";

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
  const filteredBundles = useMemo<Array<SingleBundle>>(() => {
    return searchText.length > 0 ? fuse.search(searchText).map(({ item }) => SingleBundleCodec.encode(item)) : bundles;
  }, [fuse, searchText]);

  // index to reset the list after an action
  const [listKey, setListKey] = useState(0);
  const refreshList = () => setListKey((val) => val + 1);

  const { push } = useNavigation();

  useEffect(() => {
    getBundles().then(setBundles);
  }, [listKey]);

  return (
    <List searchText={searchText} onSearchTextChange={setSearchText} navigationTitle="Fuzzy search bundles">
      <List.Section title="Bundles">
        {filteredBundles.map((item, index) => (
          <List.Item
            key={item.name + "_" + index}
            title={item.name}
            subtitle={item.description}
            accessories={[{ text: String(item.urls.length) }]}
            actions={
              <ActionPanel>
                <Action title="Open URLs" onAction={() => item.urls.map((link) => open(link))} />
                <Action
                  title="Edit Bundle"
                  onAction={() => {
                    push(<BundlerForm mode="EDIT" defaults={SingleBundleCodec.decode(item)} />, refreshList);
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
                      .then(refreshList);
                  }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
