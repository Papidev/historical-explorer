import { getPersonDisplayName } from "@/utils/getPersonDisplayName";
import { z } from "zod";
import { wikipediaSourceSchema, type WikipediaSource } from "@/server/wikipediaSources";

const sourceIdsSchema = z.array(z.string().min(1)).min(1);
const emphasisSchema = z.array(z.string().trim().min(1)).optional();

const storyInsightSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    sourceIds: sourceIdsSchema,
    emphasis: emphasisSchema,
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
        .refine((year) => year !== 0, "Year zero is not supported.")
        .optional(),
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
    wikipediaSources: z.array(wikipediaSourceSchema).optional(),
    textFormat: z.literal("markdown").optional(),
    introduction: z
      .object({
        text: z.string().min(1),
        sourceIds: sourceIdsSchema,
        emphasis: emphasisSchema,
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

export const storyContentJsonSchema = z.toJSONSchema(
  storyContentStructureSchema.omit({ wikipediaSources: true }).extend({
    textFormat: z.literal("markdown"),
    relatedPeople: z.array(relatedPersonSchema.omit({ personId: true })).max(10),
  }),
);

export type StoryContent = z.infer<typeof storyContentStructureSchema>;
export type StoryInsight = z.infer<typeof storyInsightSchema>;
export type HistoryInsight = z.infer<typeof historyInsightSchema>;
export type RelatedPerson = z.infer<typeof relatedPersonSchema>;

export const getMentionedRelatedPeople = (storyContent: StoryContent) => {
  const normalize = (text: string) =>
    ` ${text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()} `;
  const textBlocks = [
    storyContent.introduction.text,
    ...Object.values(storyContent.topics).flatMap((insights) =>
      insights.map(({ description }) => description),
    ),
  ].map(normalize);

  return storyContent.relatedPeople.filter(({ name }) =>
    textBlocks.some((text) => text.includes(normalize(getPersonDisplayName(name)))),
  );
};

const sortHistoryInsights = (insights: HistoryInsight[]) =>
  [...insights].sort((left, right) => {
    if (!left.time && !right.time) return 0;
    if (!left.time) return 1;
    if (!right.time) return -1;
    return left.time.startYear - right.time.startYear;
  });

export const parseStoryContentStructure = (value: unknown) => {
  const storyContent = storyContentStructureSchema.parse(value);
  for (const { text, emphasis } of [
    storyContent.introduction,
    ...Object.values(storyContent.topics).flatMap((insights) =>
      insights.map(({ description, emphasis }) => ({ text: description, emphasis })),
    ),
  ]) {
    for (const phrase of emphasis ?? []) {
      if (!text.includes(phrase)) {
        throw new Error(`Story emphasis phrase ${JSON.stringify(phrase)} is absent from its text.`);
      }
    }
  }
  return {
    ...storyContent,
    topics: {
      ...storyContent.topics,
      history: sortHistoryInsights(storyContent.topics.history),
    },
  };
};

export const parseStoryContent = (value: unknown, sourceIds?: string[]) => {
  const storyContent = parseStoryContentStructure(value);
  const knownSourceIds = sourceIds ? new Set(sourceIds) : undefined;
  const contentIds = new Set<string>();

  const validateSourceIds = (references: string[], label: string) => {
    for (const sourceId of references) {
      if (
        knownSourceIds
          ? !knownSourceIds.has(sourceId)
          : !/^wikipedia(?:-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)?$/.test(sourceId)
      ) {
        throw new Error(`${label} references unknown Source ${sourceId}.`);
      }
    }
  };

  validateSourceIds(storyContent.introduction.sourceIds, "Introduction");

  for (const person of storyContent.relatedPeople) {
    validateSourceIds(person.sourceIds, `Related Person ${person.name}`);
  }

  for (const insights of Object.values(storyContent.topics)) {
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
  wikipediaSources?: WikipediaSource[];
  textFormat?: "markdown";
  introduction: string;
  introductionEmphasis?: string[];
  topics: {
    history: Array<Pick<HistoryInsight, "description" | "time" | "emphasis">>;
    design: Array<Pick<StoryInsight, "description" | "emphasis">>;
    art: Array<Pick<StoryInsight, "description" | "emphasis">>;
  };
  relatedPeople: Array<Pick<RelatedPerson, "name" | "personId">>;
};

export const toPublicStoryContent = (storyContent: StoryContent): PublicStoryContent => ({
  ...(storyContent.wikipediaSources?.length
    ? { wikipediaSources: storyContent.wikipediaSources }
    : {}),
  ...(storyContent.textFormat ? { textFormat: storyContent.textFormat } : {}),
  introduction: storyContent.introduction.text,
  ...(storyContent.introduction.emphasis?.length
    ? { introductionEmphasis: storyContent.introduction.emphasis }
    : {}),
  topics: {
    history: storyContent.topics.history.map(({ description, time, emphasis }) => ({
      description,
      ...(time ? { time } : {}),
      ...(emphasis?.length ? { emphasis } : {}),
    })),
    design: storyContent.topics.design.map(({ description, emphasis }) => ({
      description,
      ...(emphasis?.length ? { emphasis } : {}),
    })),
    art: storyContent.topics.art.map(({ description, emphasis }) => ({
      description,
      ...(emphasis?.length ? { emphasis } : {}),
    })),
  },
  relatedPeople: getMentionedRelatedPeople(storyContent).map(({ name, personId }) => ({
    name: getPersonDisplayName(name),
    ...(personId ? { personId } : {}),
  })),
});
