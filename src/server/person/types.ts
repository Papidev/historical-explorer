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

export const personContentSchema = z
  .object({
    description: z.tuple([sourcedTextSchema, sourcedTextSchema]),
    curiosities: z.array(sourcedTextSchema),
    birthDate: historicalDateSchema.optional(),
    deathDate: historicalDateSchema.optional(),
  })
  .strict();

export const personContentJsonSchema = z.toJSONSchema(personContentSchema);

export type PersonContent = z.infer<typeof personContentSchema>;

export type PersonSource = {
  id: string;
  kind: "wikipedia";
  title: string;
  url: string;
  content: string;
};

export type Person = {
  id: string;
  name: string;
  wikidataId: string;
  wikipediaTitle: string;
  content: PersonContent;
  image?: MainImageCandidate;
  source: Omit<PersonSource, "content">;
  generation: {
    aiMode: "local" | "cloud";
    aiProvider: "ollama" | "gemini";
    aiModel: string;
    completedAt: string;
  };
};

export type PublicPerson = {
  id: string;
  name: string;
  description: [string, string];
  curiosities: string[];
  birthDate?: PersonContent["birthDate"];
  deathDate?: PersonContent["deathDate"];
  image?: Pick<MainImageCandidate, "thumbnailUrl" | "originalImageUrl" | "attribution" | "license">;
};

export const toPublicPerson = (person: Person): PublicPerson => ({
  id: person.id,
  name: person.name,
  description: person.content.description.map(({ text }) => text) as [string, string],
  curiosities: person.content.curiosities.map(({ text }) => text),
  ...(person.content.birthDate ? { birthDate: person.content.birthDate } : {}),
  ...(person.content.deathDate ? { deathDate: person.content.deathDate } : {}),
  ...(person.image
    ? {
        image: {
          thumbnailUrl: person.image.thumbnailUrl,
          originalImageUrl: person.image.originalImageUrl,
          license: person.image.license,
          attribution: person.image.attribution,
        },
      }
    : {}),
});
