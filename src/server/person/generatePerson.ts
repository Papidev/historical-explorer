import {
  personContentJsonSchema,
  personContentSchema,
  type PersonContent,
  type PersonSource,
} from "./types";

type Config = { mode: "local" | "cloud"; provider: "ollama" | "gemini"; model: string };

const systemPrompt = `Create concise, source-grounded content for a historical, mythological, or imaginary person.
Return only data matching the provided JSON schema.
The top-level object must contain description and curiosities, plus optional birthDate and deathDate. description must be an array of exactly two objects containing text and sourceIds. curiosities must be an array of objects containing text and sourceIds. Each date must contain year and precision, plus optional month and day. Use sourceIds as arrays of supplied Source ID strings.

Write exactly two substantial paragraphs in plain contemporary English. This is not a complete biography. Select any number of genuinely interesting curiosities, but include one only when the supplied Sources support it. Use only supplied Source IDs. Birth and death dates are optional, may be approximate, use negative years for BC/BCE, positive years for AD/CE, and never use year zero. Do not invent missing facts or dates. Do not use Markdown or HTML.`;

const cloudOllamaSystemPrompt = `${systemPrompt}\n\nJSON schema:\n${JSON.stringify(personContentJsonSchema)}`;

const parseContent = (raw: string, sourceIds: string[]) => {
  const value: unknown = JSON.parse(raw);
  const parsed = personContentSchema.safeParse(value);
  let content: PersonContent;

  if (parsed.success) {
    content = parsed.data;
  } else {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw parsed.error;
    }
    const invalidOptionalDates = new Set(
      parsed.error.issues
        .map(({ path }) => path[0])
        .filter((field) => field === "birthDate" || field === "deathDate"),
    );
    if (invalidOptionalDates.size === 0) {
      throw parsed.error;
    }
    const withoutInvalidDates: Record<string, unknown> = { ...value };
    for (const field of invalidOptionalDates) {
      delete withoutInvalidDates[field];
    }
    content = personContentSchema.parse(withoutInvalidDates);
  }

  for (const item of [...content.description, ...content.curiosities]) {
    for (const sourceId of item.sourceIds) {
      if (!sourceIds.includes(sourceId)) {
        throw new Error(`Person references unknown Source ${sourceId}.`);
      }
    }
  }
  return content;
};

export const generatePerson = async (
  person: { name: string; wikidataId: string },
  sources: PersonSource[],
  config: Config,
): Promise<PersonContent> => {
  const prompt = JSON.stringify({ person, sources }, null, 2);
  if (config.provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required when using Gemini.");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseJsonSchema: personContentJsonSchema,
          },
        }),
      },
    );
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(
        `Gemini failed: HTTP ${response.status}${data.error?.message ? ` - ${data.error.message}` : ""}`,
      );
    }
    const content = data.candidates?.[0]?.content?.parts
      ?.map(({ text }) => text ?? "")
      .join("")
      .trim();
    if (!content) throw new Error("Gemini returned an empty Person.");
    return parseContent(
      content,
      sources.map(({ id }) => id),
    );
  }

  const messages = [
    { role: "system", content: config.mode === "cloud" ? cloudOllamaSystemPrompt : systemPrompt },
    { role: "user", content: prompt },
  ];
  const attempts = config.mode === "cloud" ? 2 : 1;
  const timeoutSeconds = config.mode === "cloud" ? 300 : 120;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(
        `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(timeoutSeconds * 1_000),
          body: JSON.stringify({
            model: config.model,
            stream: false,
            ...(config.mode === "local" ? { think: false, format: personContentJsonSchema } : {}),
            options: { temperature: 0.2 },
            messages,
          }),
        },
      );
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `Ollama timed out after ${timeoutSeconds} seconds while generating ${person.name}.`,
        );
      }
      throw error;
    }
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        `Ollama failed: HTTP ${response.status}${error.error ? ` - ${error.error}` : ""}`,
      );
    }
    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content?.trim();
    if (!content) throw new Error("Ollama returned an empty Person.");

    try {
      return parseContent(
        content,
        sources.map(({ id }) => id),
      );
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      messages.push(
        { role: "assistant", content },
        {
          role: "user",
          content: `The previous response was invalid: ${error instanceof Error ? error.message : String(error)}. Return corrected JSON only, matching the provided schema.`,
        },
      );
    }
  }

  throw new Error("Ollama failed to generate Person content.");
};
