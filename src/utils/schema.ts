import { z } from "zod";

export const FormInputSchema = z.object({
  description: z.string(),
  name: z.string(),
  urls: z.string(),
  pinned: z.boolean().optional(),
  lastUpdated: z.number().optional(),
});

export const SingleBundleSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  urls: z.array(z.string().min(1)).min(1),
  pinned: z.boolean().optional(),
  lastUpdated: z.number(),
});

export const SingleBundleCodec = z.codec(
  SingleBundleSchema, // parsed schema
  FormInputSchema, // serialized schema
  {
    encode: (formInput) => ({ lastUpdated: 0, ...formInput, urls: formInput.urls.split("\n") }),
    decode: (singleBundle) => ({ ...singleBundle, urls: singleBundle.urls.join("\n") }),
  },
);

export const BundleStoreSchema = z
  .array(SingleBundleSchema)
  // validate if all bundles have unique names
  .refine((list) => list.length === new Set(list.map((item) => item.name)).size, {
    message: "Bundle already exist, please use another name.",
    path: ["name"],
  });

export type SingleBundle = z.infer<typeof SingleBundleSchema>;
export type FormMode = "EDIT" | "ADD";
