import { z } from "zod";

const candidate = z.object({
  geoPlaceId: z.string().min(1),
  name: z.string(),
  progressId: z.uuid(),
  resume: z.boolean().optional(),
});

const queueSchema = z
  .object({
    version: z.literal(1),
    runs: z.array(candidate).min(1),
    history: z.array(
      candidate.extend({
        isFinished: z.boolean(),
        storyGenerationStarted: z.boolean().optional(),
        cancelled: z.boolean().optional(),
        error: z.string().optional(),
        result: z
          .object({
            warning: z
              .object({
                title: z.string(),
                description: z.string().optional(),
                details: z.string().optional(),
              })
              .optional(),
            failedSteps: z.array(z.string()).optional(),
          })
          .optional(),
      }),
    ),
    index: z.number().int().min(0),
    started: z.number().int().min(0),
    counted: z.array(z.string()),
    completed: z.array(z.string()),
    limit: z.number().int().positive(),
    ai: z.object({ mode: z.enum(["local", "cloud"]), model: z.string().min(1) }),
    pendingId: z.uuid().optional(),
  })
  .refine((queue) => queue.index <= queue.runs.length, "Invalid saved queue position.");

export type StoryQueue = z.infer<typeof queueSchema>;
export const storyQueueStorageKey = "historical-explorer:rome:story-queue:v1";

export const loadStoryQueue = () => {
  const saved = localStorage.getItem(storyQueueStorageKey);
  return saved ? queueSchema.parse(JSON.parse(saved)) : undefined;
};

export const saveStoryQueue = (queue: StoryQueue) => {
  localStorage.setItem(storyQueueStorageKey, JSON.stringify(queue));
};
