import { Action, ActionPanel, Form, showToast, useNavigation } from "@raycast/api";
import { useCallback, useState } from "react";
import { z, ZodError } from "zod";

import { SingleBundleCodec, FormInputSchema, FormMode } from "../utils/schema";
import { onSubmitBundle } from "../utils/data";

type FormInput = z.infer<typeof FormInputSchema>;

type BundlerFormProps = {
  mode: FormMode;
  defaults?: FormInput;
};

export default function BundlerForm({ mode, defaults }: BundlerFormProps) {
  const { pop } = useNavigation();

  const [error, setError] = useState<Record<string, string>>({});
  const submit = useCallback(
    (formState: FormInput) => {
      try {
        const encodedState = SingleBundleCodec.encode(formState);

        onSubmitBundle(mode, encodedState, defaults?.name).then(() => {
          showToast({
            title: mode,
            message: `${encodedState.name} ${mode.toLocaleLowerCase()}ed with ${encodedState.urls.length} items`,
          });

          pop(); // go back up the UI
        });
      } catch (e: unknown) {
        const errorOutput: Record<string, string> = {};

        (e as ZodError).issues.map((item) => {
          const path = item.path[0] as string;
          errorOutput[path] = item.message;
        });
        setError(errorOutput);
      }
    },
    [mode, pop],
  );

  const navigationTitle = `${mode === "ADD" ? "Add" : "Edit"} Links Bundler`;

  return (
    <Form
      navigationTitle={navigationTitle}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        error={error.name}
        id="name"
        title="Name"
        defaultValue={defaults?.name}
        placeholder="Name of the links bundle"
        onChange={() => setError((error) => ({ ...error, name: "" }))}
      />
      <Form.TextField
        error={error.description}
        id="description"
        title="Description"
        defaultValue={defaults?.description}
        placeholder="Description"
      />
      <Form.TextArea
        error={error.urls ? "Error: should be a list of URLs" : ""}
        id="urls"
        title="URLs"
        defaultValue={defaults?.urls}
        placeholder="List of links, separated by new lines"
        onChange={() => setError((error) => ({ ...error, urls: "" }))}
      />
    </Form>
  );
}
