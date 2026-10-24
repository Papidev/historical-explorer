// Adapted from Papidev/historical-explorer-backend, commit 2b7b203cb2ba35dadd5a36d6b0ea6eb1bf971b1d.
import { z } from "zod";

const sourcedText = z
  .object({
    text: z.string().min(1),
    sourceIds: z.array(z.string().min(1)).min(1),
  })
  .strict();
const historicalDate = z
  .object({
    year: z
      .number()
      .int()
      .refine((year) => year !== 0),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
    precision: z.enum(["exact", "approximate"]),
  })
  .strict();

export const personContentSchema = z
  .object({
    description: z.tuple([sourcedText, sourcedText]),
    curiosities: z.array(sourcedText),
    birthDate: historicalDate.optional(),
    deathDate: historicalDate.optional(),
  })
  .strict();

export type PersonContent = z.infer<typeof personContentSchema>;
export const personContentJsonSchema = z.toJSONSchema(personContentSchema);
