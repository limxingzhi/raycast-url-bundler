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

  // sort list by last-updated before saving
  parsedList.sort((a, b) => b.lastUpdated - a.lastUpdated);

  // validating unique keys before saving
  return await LocalStorage.setItem(BUNDLE_KEY, JSON.stringify(parsedList));
}

export async function onSubmitBundle(
  mode: FormMode,
  bundle: SingleBundle,
  previousName?: string,
  overrideLastUpdated = true,
): Promise<void> {
  const list = await getBundles();

  // set the last updated time
  if (overrideLastUpdated) bundle.lastUpdated = Date.now();

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

export async function moveTop(bundleName: string): Promise<void> {
  // find the corresponding bundle
  const bundle = (await getBundles()).find((item) => item.name === bundleName);

  // bundle must exist
  if (!bundle) throw "Bundle not found";

  // an edit overrides the lastUpdated by default and
  // will be sorted accordingly before saving to store
  await onSubmitBundle("EDIT", bundle, bundleName);
}

export async function moveBottom(bundleName: string): Promise<void> {
  // find the corresponding bundle
  const bundle = (await getBundles()).find((item) => item.name === bundleName);

  // find the last bundle
  const bottomBundle = (await getBundles()).at(-1);

  // bundles must exist
  if (!bundle) throw "Bundle not found";
  if (!bottomBundle) throw "Bottom bundle not found";

  // override bundle with a lastUdpated timing that is smaller than the botom bundle
  await onSubmitBundle("EDIT", { ...bundle, lastUpdated: bottomBundle.lastUpdated - 1000 }, bundle.name, false);
}
