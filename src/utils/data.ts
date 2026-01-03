import { LocalStorage } from "@raycast/api";
import { z } from "zod";

import { SingleBundle, FormMode, SingleBundleSchema } from "./schema";
import { BUNDLE_KEY } from "./constants";

export async function getBundles(): Promise<Array<SingleBundle>> {
  const listStringified = await LocalStorage.getItem<string>(BUNDLE_KEY);
  return z.array(SingleBundleSchema).parse(JSON.parse(listStringified ?? "[]"));
}

export async function onSubmitBundle(mode: FormMode, bundle: SingleBundle, previousName?: string): Promise<void> {
  const list = await getBundles();

  if (mode == "ADD") {
    await LocalStorage.setItem(BUNDLE_KEY, JSON.stringify([bundle, ...list]));
  } else if (mode == "EDIT") {
    if (!previousName) throw "something went wrong";
    const newList = list.map((item) => {
      if (item.name !== previousName) return item;

      // item found
      return bundle;
    });

    await LocalStorage.setItem(BUNDLE_KEY, JSON.stringify(newList));
  } else {
    throw "invalid mode";
  }
}

export async function deleteBundle(bundleName: string): Promise<void> {
  const list = await getBundles();
  await LocalStorage.setItem(BUNDLE_KEY, JSON.stringify(list.filter((item) => item.name !== bundleName)));
}
