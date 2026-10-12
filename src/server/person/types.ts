import { mainImageCandidateSchema, type MainImageCandidate } from "@/server/wikiPipeline/types";
import { getPersonDisplayName } from "@/utils/getPersonDisplayName";
import { z } from "zod";

const sourceIdsSchema = z.array(z.string().min(1)).min(1);

const historicalDateSchema = z
  .object({
    year: z
      .number()
      .int()
      .refine((year) => year !== 0, "Year zero is not supported."),
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

export const personSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    wikidataId: z.string().min(1),
    wikipediaTitle: z.string().min(1),
    content: personContentSchema,
    image: mainImageCandidateSchema.optional(),
    source: z
      .object({
        id: z.string().min(1),
        kind: z.literal("wikipedia"),
        title: z.string().min(1),
        url: z.url(),
      })
      .strict(),
    generation: z
      .object({
        aiMode: z.enum(["local", "cloud"]),
        aiProvider: z.enum(["ollama", "gemini"]),
        aiModel: z.string().min(1),
        completedAt: z.iso.datetime(),
      })
      .strict(),
  })
  .strict()
  .superRefine((person, context) => {
    for (const [field, blocks] of [
      ["description", person.content.description],
      ["curiosities", person.content.curiosities],
    ] as const) {
      blocks.forEach((block, index) => {
        block.sourceIds.forEach((sourceId, sourceIndex) => {
          if (sourceId !== person.source.id) {
            context.addIssue({
              code: "custom",
              path: ["content", field, index, "sourceIds", sourceIndex],
              message: `Unknown Person Source ${sourceId}.`,
            });
          }
        });
      });
    }
  });

export type Person = z.infer<typeof personSchema>;

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
  name: getPersonDisplayName(person.name),
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
