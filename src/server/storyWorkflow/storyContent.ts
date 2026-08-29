import { z } from "zod";

const sourceIdsSchema = z.array(z.string().min(1)).min(1);

const storyInsightSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    relatedPersonIds: z.array(z.string().min(1)),
    sourceIds: sourceIdsSchema,
  })
  .strict();

const historicalTimeSchema = z
  .object({
    startYear: z
      .number()
      .int()
      .refine((year) => year !== 0, "Year zero is not supported."),
    endYear: z
      .number()
      .int()
      .refine((year) => year !== 0, "Year zero is not supported.")
      .optional(),
    precision: z.enum(["exact", "approximate"]),
    granularity: z.enum(["year", "century"]),
  })
  .strict()
  .superRefine(({ startYear, endYear, granularity }, context) => {
    if (endYear !== undefined && endYear < startYear) {
      context.addIssue({
        code: "custom",
        path: ["endYear"],
        message: "End year must not precede start year.",
      });
    }
    if (granularity === "century" && endYear === undefined) {
      context.addIssue({
        code: "custom",
        path: ["endYear"],
        message: "Century values require an end year.",
      });
    }
  });

const historyInsightSchema = storyInsightSchema.extend({
  time: historicalTimeSchema.optional(),
});

const relatedPersonSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    relationship: z.string().min(1),
    sourceIds: sourceIdsSchema,
  })
  .strict();

const storyContentStructureSchema = z
  .object({
    introduction: z
      .object({
        text: z.string().min(1),
        sourceIds: sourceIdsSchema,
      })
      .strict(),
    topics: z
      .object({
        history: z.array(historyInsightSchema),
        design: z.array(storyInsightSchema),
        art: z.array(storyInsightSchema),
      })
      .strict(),
    relatedPeople: z.array(relatedPersonSchema),
  })
  .strict();

export const storyContentJsonSchema = z.toJSONSchema(storyContentStructureSchema);

export type StoryContent = z.infer<typeof storyContentStructureSchema>;
export type StoryInsight = z.infer<typeof storyInsightSchema>;
export type HistoryInsight = z.infer<typeof historyInsightSchema>;
export type RelatedPerson = z.infer<typeof relatedPersonSchema>;

export const parseStoryContentStructure = (value: unknown) =>
  storyContentStructureSchema.parse(value);

export const parseStoryContent = (value: unknown, sourceIds: string[]) => {
  const storyContent = parseStoryContentStructure(value);
  const knownSourceIds = new Set(sourceIds);
  const knownPersonIds = new Set<string>();
  const referencedPersonIds = new Set<string>();
  const contentIds = new Set<string>();

  const validateSourceIds = (references: string[], label: string) => {
    for (const sourceId of references) {
      if (!knownSourceIds.has(sourceId)) {
        throw new Error(`${label} references unknown Source ${sourceId}.`);
      }
    }
  };

  validateSourceIds(storyContent.introduction.sourceIds, "Introduction");

  for (const person of storyContent.relatedPeople) {
    if (contentIds.has(person.id)) {
      throw new Error(`Story Content ID ${person.id} is duplicated.`);
    }
    contentIds.add(person.id);
    knownPersonIds.add(person.id);
    validateSourceIds(person.sourceIds, `Related Person ${person.id}`);
  }

  for (const [topic, insights] of Object.entries(storyContent.topics)) {
    for (const insight of insights) {
      if (contentIds.has(insight.id)) {
        throw new Error(`Story Content ID ${insight.id} is duplicated.`);
      }
      contentIds.add(insight.id);
      validateSourceIds(insight.sourceIds, `Visitor Insight ${insight.id}`);
      for (const personId of insight.relatedPersonIds) {
        if (!knownPersonIds.has(personId)) {
          throw new Error(
            `Visitor Insight ${insight.id} in ${topic} references unknown Related Person ${personId}.`,
          );
        }
        referencedPersonIds.add(personId);
      }
    }
  }

  for (const personId of knownPersonIds) {
    if (!referencedPersonIds.has(personId)) {
      throw new Error(`Related Person ${personId} is not linked to a Visitor Insight.`);
    }
  }

  return storyContent;
};

export type PublicStoryContent = {
  introduction: string;
  topics: {
    history: Array<Pick<HistoryInsight, "description" | "time">>;
    design: Array<Pick<StoryInsight, "description">>;
    art: Array<Pick<StoryInsight, "description">>;
  };
  relatedPeople: Array<Pick<RelatedPerson, "name" | "relationship">>;
};

export const toPublicStoryContent = (storyContent: StoryContent): PublicStoryContent => ({
  introduction: storyContent.introduction.text,
  topics: {
    history: storyContent.topics.history.map(({ description, time }) => ({
      description,
      ...(time ? { time } : {}),
    })),
    design: storyContent.topics.design.map(({ description }) => ({ description })),
    art: storyContent.topics.art.map(({ description }) => ({ description })),
  },
  relatedPeople: storyContent.relatedPeople.map(({ name, relationship }) => ({
    name,
    relationship,
  })),
});
