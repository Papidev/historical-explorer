type OllamaChatChunk = {
  message?: {
    content?: string;
  };
  done?: boolean;
  eval_count?: number;
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

const systemPrompt =
  "Rewrite historical POI content for a map detail panel in plain, contemporary language. This is factual visitor information, not a novel, essay, or travel brochure. Write for someone who is deciding whether to visit the spot or is standing there now. Preserve facts, dates, names, and source meaning. Do not invent information. Use short, direct paragraphs with concrete context about what the place is, what happened there, and why it matters. Use markdown bold only for proper names of places, named people or historical figures, dates or periods, named historical events, and named artistic movements. Bold every important date, period, named person, historical figure, place name, historical event, or artistic movement that appears in the final text. Apart from dates and periods, a bold phrase must be a named entity, not a common noun. Do not bold generic nouns, roles, amenities, facilities, services, functions, materials, objects, or concepts unless they are part of an allowed proper name. Before returning, check every bold phrase and remove bold if it is not one of the allowed categories. Use emphasis sparingly: usually one to three highlighted terms per paragraph, only when it helps scanning. Keep the style dry, concise, clear, conversational, and sober. Avoid literary narration, scene-setting openings, poetic language, promotional tone, suspense, grand adjectives, and decorative phrasing. Avoid schematic label/value writing. Avoid bullet lists unless the source is only a compact inventory that cannot be made readable as prose. Use few section headings, only when they improve navigation. Return markdown-compatible text only.";

const getOllamaBaseUrl = () => process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

const getOllamaModel = (model?: string) => model?.trim() || process.env.OLLAMA_MODEL || "qwen3:8b";

const getGeminiModel = (model?: string) =>
  model?.trim() || process.env.AI_MODEL || "gemini-2.5-flash";

const getAiProvider = () => process.env.AI_PROVIDER?.trim().toLowerCase() || "ollama";

const enrichWithGemini = async (content: string, model?: string) => {
  const startedAt = Date.now();
  const geminiModel = getGeminiModel(model);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini.");
  }

  console.info(
    `[wiki-ai] Starting Gemini enrichment with ${geminiModel}. Input: ${content.length} chars.`,
  );

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
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
            parts: [{ text: content }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    },
  );

  const data = (await response.json()) as GeminiGenerateContentResponse;
  if (!response.ok) {
    throw new Error(
      `Gemini failed: HTTP ${response.status}${
        data.error?.message ? ` - ${data.error.message}` : ""
      }`,
    );
  }

  const trimmedContent =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!trimmedContent) {
    throw new Error("Gemini returned empty content.");
  }

  console.info(
    `[wiki-ai] Completed Gemini enrichment in ${Math.round((Date.now() - startedAt) / 1000)}s. Output: ${trimmedContent.length} chars.`,
  );

  return `${trimmedContent}\n`;
};

const enrichWithOllama = async (content: string, model?: string) => {
  const startedAt = Date.now();
  const ollamaModel = getOllamaModel(model);
  console.info(
    `[wiki-ai] Starting Ollama enrichment with ${ollamaModel}. Input: ${content.length} chars.`,
  );

  const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      stream: true,
      options: {
        temperature: 0.2,
      },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama failed: HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Ollama returned an empty response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferedContent = "";
  let enrichedContent = "";
  let lastLogAt = startedAt;
  let lastLoggedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    bufferedContent += decoder.decode(value, { stream: !done });

    const lines = bufferedContent.split("\n");
    bufferedContent = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const chunk = JSON.parse(line) as OllamaChatChunk;
      const chunkContent = chunk.message?.content;
      if (chunkContent) {
        enrichedContent += chunkContent;
      }

      if (
        chunkContent &&
        (lastLoggedLength === 0 ||
          Date.now() - lastLogAt >= 2000 ||
          enrichedContent.length - lastLoggedLength >= 1000)
      ) {
        console.info(`[wiki-ai] Ollama generated ${enrichedContent.length} chars so far...`);
        lastLogAt = Date.now();
        lastLoggedLength = enrichedContent.length;
      }

      if (chunk.done && chunk.eval_count) {
        console.info(`[wiki-ai] Ollama generated ${chunk.eval_count} tokens.`);
      }
    }

    if (done) {
      break;
    }
  }

  const trimmedContent = enrichedContent.trim();
  if (!trimmedContent) {
    throw new Error("Ollama returned empty content.");
  }

  console.info(
    `[wiki-ai] Completed Ollama enrichment in ${Math.round((Date.now() - startedAt) / 1000)}s. Output: ${trimmedContent.length} chars.`,
  );

  return `${trimmedContent}\n`;
};

export const enrichWikiText = async (content: string, model?: string) => {
  const aiProvider = getAiProvider();
  if (aiProvider === "gemini") {
    return enrichWithGemini(content, model);
  }

  if (aiProvider === "ollama") {
    return enrichWithOllama(content, model);
  }

  throw new Error(`Unsupported AI_PROVIDER "${aiProvider}".`);
};
