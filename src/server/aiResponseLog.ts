import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sanitizeErrorMessage } from "./generationRunLog";

type Context = {
  kind: "storyContent" | "person";
  subjectId: string;
  subjectName: string;
  mode: "local" | "cloud";
  provider: "ollama" | "gemini";
  model: string;
  attempt: number;
};

export const logAiResponseFailure = (context: Context, rawResponse: string, error: unknown) => {
  try {
    const directory = path.join(process.cwd(), "data", "generated", "ai-response-failures");
    mkdirSync(directory, { recursive: true });
    const filePath = path.join(directory, `${context.kind}-${randomUUID()}.json`);
    writeFileSync(
      filePath,
      `${JSON.stringify(
        {
          ...context,
          at: new Date().toISOString(),
          error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
          rawResponse,
        },
        null,
        2,
      )}\n`,
      { flag: "wx" },
    );
    console.error(`[ai-response] Rejected ${context.kind} response saved to ${filePath}.`);
  } catch (loggingError) {
    // Diagnostic storage must not replace the original generation error.
    console.warn("[ai-response] Could not save rejected response.", loggingError);
  }
};

export const readAiResponse = async <T>(response: Response, context: Context) => {
  const rawResponse = await response.text();
  try {
    return { data: JSON.parse(rawResponse) as T, rawResponse };
  } catch (error) {
    logAiResponseFailure(context, rawResponse, error);
    throw error;
  }
};
