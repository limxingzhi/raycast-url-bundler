import { ReactElement } from "react";
import { List, ActionPanel, Action, open, showToast, Icon, Color } from "@raycast/api";

import { SingleBundle, SingleBundleCodec } from "../utils/schema";
import { deleteBundle, pinBundle } from "../utils/data";
import BundlerForm from "./form";

interface ListEntryProps {
  item: SingleBundle;
  index: number;
  refreshCallback: () => void;
  push: (ui: ReactElement, callback: () => void) => void;
}

export default function ListEntry({ item, index, refreshCallback, push }: ListEntryProps) {
  return (
    <List.Item
      key={item.name + "_" + index}
      title={item.name}
      subtitle={item.description}
      accessories={[{ text: String(item.urls.length), icon: item.pinned ? Icon.Tack : undefined }]}
      actions={
        <ActionPanel>
          <Action icon={Icon.Compass} title="Open URLs" onAction={() => item.urls.map((link) => open(link))} />
          <Action
            icon={Icon.Pencil}
            title="Edit Bundle"
            shortcut={{ modifiers: ["cmd"], key: "i" }}
            onAction={() => {
              push(<BundlerForm mode="EDIT" defaults={SingleBundleCodec.decode(item)} />, refreshCallback);
            }}
          />
          <Action.CopyToClipboard
            title="Copy Bundle"
            content={item.urls.join("\n")}
            shortcut={{ modifiers: ["cmd"], key: "y" }}
          />
          <ActionPanel.Submenu title="Delete Bundle" icon={Icon.Trash} shortcut={{ modifiers: ["cmd"], key: "d" }}>
            <Action
              icon={{ source: Icon.Warning, tintColor: Color.Red }}
              title="Confirm Delete (this is irreversible)"
              shortcut={{ modifiers: ["cmd"], key: "y" }}
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
            <Action
              icon={{ source: Icon.Undo }}
              title="Dismiss"
              onAction={refreshCallback}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
              autoFocus
            />
          </ActionPanel.Submenu>
          {item.pinned ? (
            <Action
              icon={Icon.TackDisabled}
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
              icon={Icon.Tack}
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
}

