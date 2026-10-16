import {
  fetchWithGenerationCancellation,
  throwIfGenerationCancelled,
} from "@/server/generationCancellation";
import { jsonrepair } from "jsonrepair";
import { fetchOllamaResponse } from "@/server/fetchOllamaResponse";
import { logAiResponseFailure, readAiResponse } from "@/server/aiResponseLog";
import type { PoiInput } from "@/server/wikiPipeline/types";
import {
  getMentionedRelatedPeople,
  parseStoryContent,
  storyContentJsonSchema,
  type StoryContent,
} from "./storyContent";
import type { Source } from "./types";

type AiGenerationConfig = {
  mode: "local" | "cloud";
  provider: "ollama" | "gemini";
  model: string;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const systemPrompt = `Create descriptive, source-grounded Story Content for a cultural POI.
Return only data matching the provided JSON schema.
Read all supplied Wikipedia editions as complementary Sources, including non-English text. Write the Story in English regardless of Source language. Preserve useful details found only in local editions. Do not assume English is more authoritative; when Sources disagree, preserve attribution and uncertainty or omit the disputed claim rather than silently choosing a version. Cite the specific Source IDs that support each block.
The top-level object must contain exactly textFormat, introduction, topics, and relatedPeople. Set textFormat to "markdown". introduction must contain text and sourceIds. topics must contain history, design, and art arrays. Every topic item must contain id, description, and sourceIds. Use Markdown inside introduction.text and topic descriptions; omit the legacy emphasis field. Only history items may additionally contain time. A time value must always be an object, never a number or string: use {"startYear": 312, "precision": "exact", "granularity": "year"} for a year, or use granularity "century" for a century. Include endYear only when the Source supports a range; it is optional for a single century. Every relatedPeople item must contain only name and sourceIds. Use sourceIds as arrays of supplied Source ID strings. Never return source, history, design, art, visitorInsights, or people as top-level fields.

The introduction must give a developed, self-contained description of what and where the POI is, its spaces or structure, and interesting features, works, or objects it contains. Give readers a substantial first understanding, with depth proportionate to the supplied Sources rather than a fixed length. Describe interesting details on their own merits; the Story does not need a single central theme.
Write the introduction and topic descriptions in short paragraphs, each developing one coherent idea. Prefer a paragraph break after a sentence when it introduces a distinct idea, shifts focus, or gives the reader a useful pause. Keep closely connected sentences together; punctuation alone is not a reason to break, and periods in abbreviations or numbers are not sentence boundaries. Separate paragraphs with a blank line (encoded as \\n\\n in the JSON string). This is an editorial preference, not a requirement to break after every sentence or pad brief text to force multiple paragraphs.
Use only the optional Story Topics history, design, and art. Omit unsupported topics by returning an empty array. Each Visitor Insight must contain one useful, independent idea rather than a complete article summary.
Concise means avoiding filler and repetition, not compressing every idea into a single sentence. When the Sources are rich, develop the strongest ideas in short paragraphs with enough context to explain the events, the stakes, and their significance for this place. Include motives and consequences only when explicitly supported by the Sources; preserve uncertainty and attribution.
Prioritize distinctive, source-supported episodes that explain the POI's cultural meaning, including disputes, attempts to remove or preserve it, changes in use, and revealing artistic details. Do not reduce History to a list of dates or Art to a list of names. Prefer events and details about this POI; omit facts about other places unless they directly help explain it. Develop worthwhile details in readable paragraphs rather than reducing them to disconnected facts; there is no fixed number of insights. Do not pad sparse Sources or invent a missing episode from general knowledge.
Select Related People only from people explicitly named in the introduction or topic descriptions you write. Mention each retained person's full name at least once in that text, omitting any parenthetical Wikipedia disambiguation suffix. Do not select people mentioned only in the Sources, and do not add incidental people to the Story just to populate Related People. Return an empty relatedPeople array when the Story names no relevant people.

Use Markdown **bold** selectively in the introduction and topic descriptions to help readers recognize an important feature, orient themselves, or find a worthwhile detail while scanning. There is no quota: a paragraph or Story may have no bold text. Do not bold names, dates, first words, or generic terms automatically. Use *italics* when useful, for example for the title of a work. Keep paragraphs as the default; use a list or link only when it adds clear reading value. Keep each person's full name together in the visible text, rather than formatting individual words separately.

Use plain contemporary English. Use Markdown for text formatting. Do not use HTML, JSX, embedded images, headings that duplicate Story sections, promotional language, poetic narration, or invented facts. The Main Image is handled separately. Use only Source IDs supplied in the input. Include each person only once. For each Related Person, use the exact Wikipedia link title supplied in Source links as the name, rather than adding honorifics or inventing a different spelling; omit people mentioned only in the prose without a personal Wikipedia link. Select at most ten people who are most significant to understanding the POI, ordered from most to least significant. A person may be historical, mythological, or imaginary. Return only each person's name and supporting Source IDs; do not describe or classify the relationship.

For History, include structured time only when the Source supports it. Use negative years for BC/BCE, positive years for AD/CE, and never use year zero. Preserve approximate dates and century granularity. Never invent a missing range boundary. Omit time when the Source does not support a date. Order dated History Insights from oldest to newest and place undated History Insights after them.`;

const cloudOllamaSystemPrompt = `${systemPrompt}

JSON schema:
${JSON.stringify(storyContentJsonSchema)}`;

const getOllamaBaseUrl = () => process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

const getGeminiApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required when using Gemini.");
  }
  return apiKey;
};

const toPrompt = (pointOfInterest: PoiInput, sources: Source[]) =>
  JSON.stringify(
    {
      pointOfInterest: {
        id: pointOfInterest.id,
        name: pointOfInterest.name,
        city: pointOfInterest.city,
      },
      sources: sources.map(({ id, kind, title, url, content, links }) => ({
        id,
        kind,
        title,
        url,
        content,
        links: links ?? [],
      })),
    },
    null,
    2,
  );

const parseGeneratedContent = (content: string, sources: Source[]) => {
  let generated: unknown;
  let parseError: unknown;
  try {
    generated = JSON.parse(content);
  } catch (error) {
    throwIfGenerationCancelled();
    if (!(error instanceof SyntaxError)) throw error;
    parseError = error;
    try {
      // Some models prefix topic objects with an extra quote: ,"{"id":...
      generated = JSON.parse(jsonrepair(content.replace(/,\s*"(?=\{\s*"id"\s*:)/g, ",")));
    } catch {
      throw error;
    }
  }
  if (
    generated &&
    typeof generated === "object" &&
    "topics" in generated &&
    generated.topics &&
    typeof generated.topics === "object"
  ) {
    const topics = generated.topics as Record<string, unknown>;
    for (const topic of ["history", "design", "art"]) {
      if (Array.isArray(topics[topic])) {
        topics[topic] = topics[topic].map((item: unknown) => {
          if (typeof item !== "string") return item;
          try {
            return JSON.parse(item);
          } catch {
            // Keep invalid values so schema validation still rejects them.
            return item;
          }
        });
      }
    }
  }
  // A repaired object must report its current schema errors to the retry.
  // Preserve the syntax error when recovery only produced a primitive value.
  if (parseError && (!generated || typeof generated !== "object")) throw parseError;
  const storyContent = parseStoryContent(
    generated,
    sources.map(({ id }) => id),
  );
  if (parseError)
    console.warn("[story-content] Recovered malformed JSON and validated the Story schema.");
  return {
    ...storyContent,
    relatedPeople: getMentionedRelatedPeople(storyContent).map(({ name, sourceIds }) => ({
      name,
      sourceIds,
    })),
  };
};

const generateWithGemini = async (
  pointOfInterest: PoiInput,
  sources: Source[],
  model: string,
  mode: AiGenerationConfig["mode"],
) => {
  const response = await fetchWithGenerationCancellation(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getGeminiApiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: toPrompt(pointOfInterest, sources) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: storyContentJsonSchema,
        },
      }),
    },
  );
  const context = {
    kind: "storyContent" as const,
    subjectId: pointOfInterest.id,
    subjectName: pointOfInterest.name,
    mode,
    provider: "gemini" as const,
    model,
    attempt: 1,
  };
  const { data, rawResponse } = await readAiResponse<GeminiGenerateContentResponse>(
    response,
    context,
  );
  try {
    if (!response.ok) {
      throw new Error(
        `Gemini failed: HTTP ${response.status}${
          data.error?.message ? ` - ${data.error.message}` : ""
        }`,
      );
    }
    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";
    if (!content) {
      throw new Error("Gemini returned empty Story Content.");
    }
    return parseGeneratedContent(content, sources);
  } catch (error) {
    throwIfGenerationCancelled();
    logAiResponseFailure(context, rawResponse, error);
    throw error;
  }
};

const generateWithOllama = async (
  pointOfInterest: PoiInput,
  sources: Source[],
  model: string,
  mode: AiGenerationConfig["mode"],
) => {
  const messages = [
    { role: "system", content: mode === "cloud" ? cloudOllamaSystemPrompt : systemPrompt },
    { role: "user", content: toPrompt(pointOfInterest, sources) },
  ];
  const attempts = mode === "cloud" ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetchOllamaResponse(`${getOllamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        ...(mode === "local" ? { format: storyContentJsonSchema } : {}),
        options: { temperature: 0.2 },
        messages,
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama failed: HTTP ${response.status}`);
    }
    const context = {
      kind: "storyContent" as const,
      subjectId: pointOfInterest.id,
      subjectName: pointOfInterest.name,
      mode,
      provider: "ollama" as const,
      model,
      attempt: attempt + 1,
    };
    const { data, rawResponse } = await readAiResponse<OllamaChatResponse>(response, context);
    const content = data.message?.content?.trim() ?? "";
    if (!content) {
      const error = new Error("Ollama returned empty Story Content.");
      logAiResponseFailure(context, rawResponse, error);
      throw error;
    }

    try {
      return parseGeneratedContent(content, sources);
    } catch (error) {
      throwIfGenerationCancelled();
      logAiResponseFailure(context, rawResponse, error);
      if (attempt === attempts - 1) throw error;
      messages.push(
        { role: "assistant", content },
        {
          role: "user",
          content: `The previous response was invalid: ${
            error instanceof Error ? error.message : "Unknown validation error"
          }. Return corrected JSON only, matching the provided schema.`,
        },
      );
    }
  }

  throw new Error("Ollama failed to generate Story Content.");
};

export const generateStoryContent = async (
  pointOfInterest: PoiInput,
  sources: Source[],
  config: AiGenerationConfig,
): Promise<StoryContent> => {
  const startedAt = Date.now();
  console.info(`[story-content] Starting ${config.provider} generation with ${config.model}.`);
  let storyContent: StoryContent;
  try {
    storyContent =
      config.provider === "gemini"
        ? await generateWithGemini(pointOfInterest, sources, config.model, config.mode)
        : await generateWithOllama(pointOfInterest, sources, config.model, config.mode);
  } catch (error) {
    throwIfGenerationCancelled();
    console.error(`[story-content] ${config.provider} generation failed.`, error);
    throw error;
  }
  console.info(
    `[story-content] Received ${config.provider} Story Content in ${Math.round((Date.now() - startedAt) / 1000)}s.`,
  );
  return storyContent;
};
