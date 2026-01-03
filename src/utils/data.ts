import { LocalStorage } from "@raycast/api";
import { z } from "zod";

import { SingleBundle, FormMode, SingleBundleSchema, BundleStoreSchema } from "./schema";
import { BUNDLE_KEY } from "./constants";

export async function getBundles(): Promise<Array<SingleBundle>> {
  const listStringified = await LocalStorage.getItem<string>(BUNDLE_KEY);
  return z.array(SingleBundleSchema).parse(JSON.parse(listStringified ?? "[]"));
}

async function save(list: Array<SingleBundle>) {
  const parsedList = await BundleStoreSchema.parseAsync(list);

  // validating unique keys before saving
  return await LocalStorage.setItem(BUNDLE_KEY, JSON.stringify(parsedList));
}

export async function onSubmitBundle(mode: FormMode, bundle: SingleBundle, previousName?: string): Promise<void> {
  const list = await getBundles();

  if (mode == "ADD") {
    await save([...list, bundle]);
  } else if (mode == "EDIT") {
    if (!previousName) throw "something went wrong";
    const newList = list.map((item) => {
      if (item.name !== previousName) return item;

      // item found
      return {
        ...item,
        ...bundle,
      };
    });
    await save(newList);
  } else {
    throw "invalid mode";
  }
}

export async function deleteBundle(bundleName: string): Promise<void> {
  const list = await getBundles();
  await save(list.filter((item) => item.name !== bundleName));
}

export async function pinBundle(bundleName: string, pinned = true): Promise<void> {
  const list = await getBundles();

  // find and update the bundle's pinned state
  const updatedBundle = list.find((item) => item.name === bundleName) as SingleBundle;
  if (!updatedBundle) throw "no bundle found";
  updatedBundle.pinned = pinned;

  await onSubmitBundle("EDIT", updatedBundle, bundleName);
}
