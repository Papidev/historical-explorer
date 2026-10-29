// Adapted from Papidev/mira-admin, commit 2b7b203cb2ba35dadd5a36d6b0ea6eb1bf971b1d.
import { z } from "zod";

const sourceIds = z.array(z.string().min(1)).min(1);
const insight = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    sourceIds,
  })
  .strict();
const time = z
  .object({
    startYear: z
      .number()
      .int()
      .refine((year) => year !== 0),
    endYear: z
      .number()
      .int()
      .refine((year) => year !== 0)
      .optional(),
    precision: z.enum(["exact", "approximate"]),
    granularity: z.enum(["year", "century"]),
  })
  .strict()
  .refine(({ startYear, endYear }) => endYear === undefined || endYear >= startYear);

export const storyContentSchema = z
  .object({
    textFormat: z.literal("markdown"),
    introduction: z.object({ text: z.string().min(1), sourceIds }).strict(),
    topics: z
      .object({
        history: z.array(insight.extend({ time: time.optional() })),
        design: z.array(insight),
        art: z.array(insight),
      })
      .strict(),
    relatedPeople: z
      .array(
        z
          .object({
            name: z.string().min(1),
            personId: z.string().min(1).optional(),
            sourceIds,
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export type StoryContent = z.infer<typeof storyContentSchema>;
export const storyContentJsonSchema = z.toJSONSchema(storyContentSchema);

export const parseStoryContent = (value: unknown, knownSourceIds: string[]): StoryContent => {
  const content = storyContentSchema.parse(value);
  const validIds = new Set(knownSourceIds);
  const insightIds = new Set<string>();
  const references = [content.introduction.sourceIds];
  for (const items of Object.values(content.topics)) {
    for (const item of items) {
      if (insightIds.has(item.id)) throw new Error(`Duplicate Story Content ID ${item.id}.`);
      insightIds.add(item.id);
      references.push(item.sourceIds);
    }
  }
  references.push(...content.relatedPeople.map(({ sourceIds }) => sourceIds));
  for (const ids of references) {
    for (const id of ids) {
      if (!validIds.has(id)) throw new Error(`Unknown Source ${id}.`);
    }
  }
  content.topics.history.sort((left, right) =>
    left.time && right.time
      ? left.time.startYear - right.time.startYear
      : left.time
        ? -1
        : right.time
          ? 1
          : 0,
  );
  return content;
};
