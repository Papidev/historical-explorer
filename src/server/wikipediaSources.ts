import { z } from "zod";

export const wikipediaSourceSchema = z.object({
  title: z.string().min(1),
  url: z
    .url()
    .refine((value) => /^https:\/\/(?:en|it|fr|de|es)\.wikipedia\.org\/wiki\/\S+$/.test(value)),
});

export type WikipediaSource = z.infer<typeof wikipediaSourceSchema>;

export const toWikipediaSources = (sources: Array<{ title: string; url: string }>) => {
  const urls = new Set<string>();
  return sources.flatMap((source) => {
    const parsed = wikipediaSourceSchema.safeParse(source);
    if (!parsed.success || urls.has(parsed.data.url)) return [];
    urls.add(parsed.data.url);
    return [parsed.data];
  });
};
