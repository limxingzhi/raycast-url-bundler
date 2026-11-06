import { List, ActionPanel, Action, open, showToast, Icon, Color, Keyboard, useNavigation } from "@raycast/api";

import { SingleBundle, SingleBundleCodec } from "../utils/schema";
import { deleteBundle, pinBundle, moveTop, moveBottom } from "../utils/data";
import BundlerForm from "./form";

interface ListEntryProps {
  item: SingleBundle;
  index: number;
  listLength: number;
  refreshCallback: () => void;
}

export default function ListEntry({ item, index, refreshCallback, listLength }: ListEntryProps) {
  const { push } = useNavigation();
  return (
    <List.Item
      key={item.name}
      id={item.name}
      title={item.name}
      subtitle={item.description}
      accessories={[{ text: String(item.urls.length), icon: item.pinned ? Icon.Tack : undefined }]}
      actions={
        <ActionPanel>
          <Action icon={Icon.Compass} title="Open URLs" onAction={() => item.urls.map((link) => open(link))} />
          <Action
            icon={Icon.Pencil}
            title="Edit Bundle"
            shortcut={Keyboard.Shortcut.Common.Edit}
            onAction={() => {
              push(<BundlerForm mode="EDIT" defaults={SingleBundleCodec.decode(item)} />, refreshCallback);
            }}
          />
          <Action.CopyToClipboard
            title="Copy Bundle"
            content={item.urls.join("\n")}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
          <ActionPanel.Submenu title="Delete Bundle" icon={Icon.Trash} shortcut={Keyboard.Shortcut.Common.Remove}>
            <Action
              style={Action.Style.Destructive}
              icon={{ source: Icon.Warning, tintColor: Color.Red }}
              title="Confirm Delete (This Is Irreversible)"
              shortcut={Keyboard.Shortcut.Common.RemoveAll}
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
              shortcut={Keyboard.Shortcut.Common.Refresh}
              autoFocus
            />
          </ActionPanel.Submenu>
          <ActionPanel.Section title="Positioning">
            {item.pinned ? (
              <Action
                icon={Icon.TackDisabled}
                title="Unpin Bundle"
                shortcut={Keyboard.Shortcut.Common.Pin}
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
                shortcut={Keyboard.Shortcut.Common.Pin}
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
            {index !== 0 && (
              <Action
                icon={{ source: Icon.ArrowUp }}
                title="Move to Top"
                onAction={() => moveTop(item.name).then(refreshCallback)}
                shortcut={Keyboard.Shortcut.Common.MoveUp}
              />
            )}
            {index + 1 < listLength && (
              <Action
                icon={{ source: Icon.ArrowDown }}
                title="Move to Bottom"
                onAction={() => moveBottom(item.name).then(refreshCallback)}
                shortcut={Keyboard.Shortcut.Common.MoveDown}
              />
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
