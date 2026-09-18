import type { MainImageCandidate } from "@/server/wikiPipeline/types";
import { z } from "zod";

const sourceIdsSchema = z.array(z.string().min(1)).min(1);

const historicalDateSchema = z
  .object({
    year: z.number().int().refine((year) => year !== 0, "Year zero is not supported."),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
    precision: z.enum(["exact", "approximate"]),
  })
  .strict();

const sourcedTextSchema = z
  .object({
    text: z.string().min(1),
    sourceIds: sourceIdsSchema,
  })
  .strict();

export const personProfileContentSchema = z
  .object({
    description: z.tuple([sourcedTextSchema, sourcedTextSchema]),
    curiosities: z.array(sourcedTextSchema),
    birthDate: historicalDateSchema.optional(),
    deathDate: historicalDateSchema.optional(),
  })
  .strict();

export const personProfileContentJsonSchema = z.toJSONSchema(personProfileContentSchema);

export type PersonProfileContent = z.infer<typeof personProfileContentSchema>;

export type PersonProfileSource = {
  id: string;
  kind: "wikipedia";
  title: string;
  url: string;
  content: string;
};

export type PersonProfile = {
  id: string;
  name: string;
  wikidataId: string;
  wikipediaTitle: string;
  content: PersonProfileContent;
  image?: MainImageCandidate;
  source: Omit<PersonProfileSource, "content">;
  generation: {
    aiMode: "local" | "cloud";
    aiProvider: "ollama" | "gemini";
    aiModel: string;
    completedAt: string;
  };
};

export type PublicPersonProfile = {
  id: string;
  name: string;
  description: [string, string];
  curiosities: string[];
  birthDate?: PersonProfileContent["birthDate"];
  deathDate?: PersonProfileContent["deathDate"];
  image?: Pick<MainImageCandidate, "thumbnailUrl" | "originalImageUrl" | "attribution" | "license">;
};

export const toPublicPersonProfile = (profile: PersonProfile): PublicPersonProfile => ({
  id: profile.id,
  name: profile.name,
  description: profile.content.description.map(({ text }) => text) as [string, string],
  curiosities: profile.content.curiosities.map(({ text }) => text),
  ...(profile.content.birthDate ? { birthDate: profile.content.birthDate } : {}),
  ...(profile.content.deathDate ? { deathDate: profile.content.deathDate } : {}),
  ...(profile.image
    ? {
        image: {
          thumbnailUrl: profile.image.thumbnailUrl,
          originalImageUrl: profile.image.originalImageUrl,
          license: profile.image.license,
          attribution: profile.image.attribution,
        },
      }
    : {}),
});
