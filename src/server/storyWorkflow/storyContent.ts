import { z } from "zod";

const sourceIdsSchema = z.array(z.string().min(1)).min(1);

const storyInsightSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    sourceIds: sourceIdsSchema,
  })
  .strict();

const historicalTimeFields = {
  startYear: z
    .number()
    .int()
    .refine((year) => year !== 0, "Year zero is not supported."),
  precision: z.enum(["exact", "approximate"]),
};

const validateHistoricalTimeRange = (
  { startYear, endYear }: { startYear: number; endYear?: number },
  context: z.RefinementCtx,
) => {
    if (endYear !== undefined && endYear < startYear) {
      context.addIssue({
        code: "custom",
        path: ["endYear"],
        message: "End year must not precede start year.",
      });
    }
};

const historicalTimeSchema = z.discriminatedUnion("granularity", [
  z
    .object({
      ...historicalTimeFields,
      endYear: z
        .number()
        .int()
        .refine((year) => year !== 0, "Year zero is not supported.")
        .optional(),
      granularity: z.literal("year"),
    })
    .strict()
    .superRefine(validateHistoricalTimeRange),
  z
    .object({
      ...historicalTimeFields,
      endYear: z
        .number()
        .int()
        .refine((year) => year !== 0, "Year zero is not supported."),
      granularity: z.literal("century"),
    })
    .strict()
    .superRefine(validateHistoricalTimeRange),
]);

const historyInsightSchema = storyInsightSchema.extend({
  time: historicalTimeSchema.optional(),
});

const relatedPersonSchema = z
  .object({
    name: z.string().min(1),
    personId: z.string().min(1).optional(),
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
    relatedPeople: z.array(relatedPersonSchema).max(10),
  })
  .strict();

export const storyContentJsonSchema = z.toJSONSchema(storyContentStructureSchema);

export type StoryContent = z.infer<typeof storyContentStructureSchema>;
export type StoryInsight = z.infer<typeof storyInsightSchema>;
export type HistoryInsight = z.infer<typeof historyInsightSchema>;
export type RelatedPerson = z.infer<typeof relatedPersonSchema>;

const sortHistoryInsights = (insights: HistoryInsight[]) =>
  [...insights].sort((left, right) => {
    if (!left.time && !right.time) return 0;
    if (!left.time) return 1;
    if (!right.time) return -1;
    return left.time.startYear - right.time.startYear;
  });

export const parseStoryContentStructure = (value: unknown) => {
  const storyContent = storyContentStructureSchema.parse(value);
  return {
    ...storyContent,
    topics: {
      ...storyContent.topics,
      history: sortHistoryInsights(storyContent.topics.history),
    },
  };
};

export const parseStoryContent = (value: unknown, sourceIds: string[]) => {
  const storyContent = parseStoryContentStructure(value);
  const knownSourceIds = new Set(sourceIds);
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
    validateSourceIds(person.sourceIds, `Related Person ${person.name}`);
  }

  for (const [topic, insights] of Object.entries(storyContent.topics)) {
    for (const insight of insights) {
      if (contentIds.has(insight.id)) {
        throw new Error(`Story Content ID ${insight.id} is duplicated.`);
      }
      contentIds.add(insight.id);
      validateSourceIds(insight.sourceIds, `Visitor Insight ${insight.id}`);
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
  relatedPeople: Array<Pick<RelatedPerson, "name" | "personId">>;
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
  relatedPeople: storyContent.relatedPeople.map(({ name, personId }) => ({
    name,
    ...(personId ? { personId } : {}),
  })),
});
