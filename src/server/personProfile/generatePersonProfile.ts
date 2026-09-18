import {
  personProfileContentJsonSchema,
  personProfileContentSchema,
  type PersonProfileContent,
  type PersonProfileSource,
} from "./types";

type Config = { provider: "ollama" | "gemini"; model: string };

const systemPrompt = `Create a concise, source-grounded profile for a historical, mythological, or imaginary person.
Return only data matching the provided JSON schema.
The top-level object must contain description and curiosities, plus optional birthDate and deathDate. description must be an array of exactly two objects containing text and sourceIds. curiosities must be an array of objects containing text and sourceIds. Each date must contain year and precision, plus optional month and day. Use sourceIds as arrays of supplied Source ID strings.

Write exactly two substantial paragraphs in plain contemporary English. This is not a complete biography. Select any number of genuinely interesting curiosities, but include one only when the supplied Sources support it. Use only supplied Source IDs. Birth and death dates are optional, may be approximate, use negative years for BC/BCE, positive years for AD/CE, and never use year zero. Do not invent missing facts or dates. Do not use Markdown or HTML.`;

const parseContent = (raw: string, sourceIds: string[]) => {
  const content = personProfileContentSchema.parse(JSON.parse(raw));
  for (const item of [...content.description, ...content.curiosities]) {
    for (const sourceId of item.sourceIds) {
      if (!sourceIds.includes(sourceId)) {
        throw new Error(`Person Profile references unknown Source ${sourceId}.`);
      }
    }
  }
  return content;
};

export const generatePersonProfile = async (
  person: { name: string; wikidataId: string },
  sources: PersonProfileSource[],
  config: Config,
): Promise<PersonProfileContent> => {
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
            responseJsonSchema: personProfileContentJsonSchema,
          },
        }),
      },
    );
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(`Gemini failed: HTTP ${response.status}${data.error?.message ? ` - ${data.error.message}` : ""}`);
    }
    const content = data.candidates?.[0]?.content?.parts?.map(({ text }) => text ?? "").join("").trim();
    if (!content) throw new Error("Gemini returned an empty Person Profile.");
    return parseContent(content, sources.map(({ id }) => id));
  }

  const response = await fetch(`${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      format: personProfileContentJsonSchema,
      options: { temperature: 0.2 },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Ollama failed: HTTP ${response.status}`);
  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content?.trim();
  if (!content) throw new Error("Ollama returned an empty Person Profile.");
  return parseContent(content, sources.map(({ id }) => id));
};
