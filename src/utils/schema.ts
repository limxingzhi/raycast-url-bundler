import { z } from "zod";

export const FormInputSchema = z.object({
  description: z.string(),
  name: z.string(),
  urls: z.string(),
});

export const SingleBundleSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  urls: z.array(z.string().min(1)).min(1),
});

export const SingleBundleCodec = z.codec(
  SingleBundleSchema, // parsed schema
  FormInputSchema, // serialized schema
  {
    encode: (formInput) => ({ ...formInput, urls: formInput.urls.split("\n") }),
    decode: (singleBundle) => ({ ...singleBundle, urls: singleBundle.urls.join("\n") }),
  },
);

export type SingleBundle = z.infer<typeof SingleBundleSchema>;
export type FormMode = "EDIT" | "ADD";

