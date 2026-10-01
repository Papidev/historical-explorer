import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MainImageCandidate, WikiSnapshot } from "@/server/wikiPipeline/types";
import { createFilesystemPersonRepository } from "./filesystemRepository";
import { createPeople } from ".";
import type { PersonContent } from "./types";

const directories: string[] = [];

const createRepository = () => {
  const directory = mkdtempSync(path.join(tmpdir(), "people-"));
  directories.push(directory);
  return createFilesystemPersonRepository(directory);
};

const content: PersonContent = {
  description: [
    { text: "First sourced paragraph.", sourceIds: ["wikipedia"] },
    { text: "Second sourced paragraph.", sourceIds: ["wikipedia"] },
  ],
  curiosities: [{ text: "A sourced curiosity.", sourceIds: ["wikipedia"] }],
};

const image = (metadata: boolean): MainImageCandidate => ({
  commonsFileName: "Hercules.jpg",
  commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Hercules.jpg",
  thumbnailUrl: "https://upload.wikimedia.org/thumb/Hercules.jpg",
  originalImageUrl: "https://upload.wikimedia.org/Hercules.jpg",
  license: metadata ? "CC BY-SA 4.0" : undefined,
  attribution: metadata ? "Example artist" : undefined,
  discoveredVia: "wikidata-p18",
  isProposed: true,
});

const snapshot = (title: string, wikidataId?: string): WikiSnapshot => ({
  title,
  fullText: `'''${title}''' is supported source text.`,
  links: [],
  ...(wikidataId ? { wikidataId } : {}),
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("People", () => {
  it("uses the selected Ollama Cloud model for People", async () => {
    vi.stubEnv("CLOUD_AI_PROVIDER", "ollama");
    const repository = createRepository();
    let generationConfig:
      | { mode: "local" | "cloud"; provider: "ollama" | "gemini"; model: string }
      | undefined;
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => snapshot(title, "Q100"),
      generateContent: async (_person, _sources, config) => {
        generationConfig = config;
        return content;
      },
      fetchImageCandidates: async () => [],
    });

    await people.resolveAndGenerateMissing({
      relatedPeople: [{ name: "Hercules", sourceIds: ["wikipedia"] }],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia",
          title: "Forum Boarium",
          url: "https://en.wikipedia.org/wiki/Forum_Boarium",
          content: "Story source",
          links: [{ label: "Hercules", title: "Hercules" }],
        },
      ],
      ai: { mode: "cloud", model: "gpt-oss:20b-cloud" },
    });

    expect(generationConfig).toEqual({
      mode: "cloud",
      provider: "ollama",
      model: "gpt-oss:20b-cloud",
    });
    expect(repository.get("hercules")?.generation).toMatchObject({
      aiMode: "cloud",
      aiProvider: "ollama",
      aiModel: "gpt-oss:20b-cloud",
    });
  });

  it("resolves a unique Wikipedia link and retains source and image rights metadata", async () => {
    const repository = createRepository();
    const generatedSources: string[] = [];
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => snapshot(title, "Q100"),
      generateContent: async (_person, sources) => {
        generatedSources.push(sources[0].content);
        return content;
      },
      fetchImageCandidates: async () => [image(false), image(true)],
      now: () => new Date("2026-09-19T10:00:00.000Z"),
    });

    await expect(
      people.resolveAndGenerateMissing({
        relatedPeople: [{ name: "Hercules", sourceIds: ["wikipedia"] }],
        storySources: [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Forum Boarium",
            url: "https://en.wikipedia.org/wiki/Forum_Boarium",
            content: "Story source",
            links: [{ label: "Hercules", title: "Hercules" }],
          },
        ],
        ai: { mode: "local", model: "person-model" },
      }),
    ).resolves.toEqual({
      relatedPeople: [{ name: "Hercules", personId: "hercules", sourceIds: ["wikipedia"] }],
      failures: [],
    });

    const person = repository.get("hercules");
    expect(generatedSources).toEqual(["Hercules is supported source text.\n"]);
    expect(person).toMatchObject({
      wikidataId: "Q100",
      source: {
        title: "Hercules",
        url: "https://en.wikipedia.org/wiki/Hercules",
      },
      image: {
        commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Hercules.jpg",
        license: "CC BY-SA 4.0",
        attribution: "Example artist",
      },
      generation: {
        aiMode: "local",
        aiModel: "person-model",
        completedAt: "2026-09-19T10:00:00.000Z",
      },
    });
    expect(repository.readSource(person!)).toMatchObject({
      title: "Hercules",
      content: "Hercules is supported source text.",
    });
  });

  it.each([
    ["Emperor Marcus Aurelius", "Marcus Aurelius"],
    ["Queen Elizabeth II", "Elizabeth II"],
    ["St. Catherine of Siena", "Catherine of Siena"],
    ["Sir Isaac Newton", "Isaac Newton"],
    ["Gregorio Zappala", "Gregorio Zappalà"],
    ["Jean–Baptiste d’Anville", "Jean-Baptiste d'Anville"],
    ["Marcus Aurelius", "Marcus_Aurelius#Life"],
  ])("resolves the sourced name variant %s to %s", async (name, title) => {
    const fetchedTitles: string[] = [];
    const people = createPeople({
      repository: createRepository(),
      fetchSnapshot: async (title) => {
        fetchedTitles.push(title);
        return snapshot(title, "Q100");
      },
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [{ name, sourceIds: ["wikipedia"] }],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia",
          title: "Example",
          url: "https://en.wikipedia.org/wiki/Example",
          content: "Source text",
          links: [{ label: title, title }],
        },
      ],
      ai: { mode: "local", model: "person-model" },
    });
    expect(result.failures).toEqual([]);
    expect(result.relatedPeople).toHaveLength(1);
    expect(result.relatedPeople[0].personId).toBeDefined();
    expect(fetchedTitles).toEqual([title.split("#")[0]]);
  });

  it("prefers an exact identity and keeps distinct resolved people with the same name", async () => {
    const fetchedTitles: string[] = [];
    const people = createPeople({
      repository: createRepository(),
      fetchSnapshot: async (title) => {
        fetchedTitles.push(title);
        return snapshot(title, "Q100");
      },
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [
        { name: "John Smith (architect)", sourceIds: ["wikipedia"] },
        { name: "John Smith", personId: "smith-artist", sourceIds: ["wikipedia"] },
        { name: "John Smith", personId: "smith-explorer", sourceIds: ["wikipedia"] },
      ],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia",
          title: "Example",
          url: "https://en.wikipedia.org/wiki/Example",
          content: "Source text",
          links: [
            { label: "John Smith", title: "John Smith (architect)" },
            { label: "John Smith", title: "John Smith (artist)" },
          ],
        },
      ],
      ai: { mode: "local", model: "person-model" },
    });
    expect(result.failures).toEqual([]);
    expect(result.relatedPeople).toHaveLength(3);
    expect(result.relatedPeople.map(({ personId }) => personId)).toEqual([
      "john-smith-architect",
      "smith-artist",
      "smith-explorer",
    ]);
    expect(fetchedTitles).toEqual(["John Smith (architect)"]);
  });

  it("keeps ambiguous normalized matches unresolved and never matches a surname alone", async () => {
    const people = createPeople({
      repository: createRepository(),
      fetchSnapshot: async () => {
        throw new Error("An uncertain identity must not be fetched.");
      },
    });
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [
        { name: "King Alexander", sourceIds: ["wikipedia"] },
        { name: "Newton", sourceIds: ["wikipedia"] },
      ],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia",
          title: "Example",
          url: "https://en.wikipedia.org/wiki/Example",
          content: "Source text",
          links: [
            { label: "Alexander", title: "Alexander I" },
            { label: "Alexander", title: "Alexander II" },
            { label: "Isaac Newton", title: "Isaac Newton" },
          ],
        },
      ],
      ai: { mode: "local", model: "person-model" },
    });
    expect(result.relatedPeople).toEqual([{ name: "King Alexander", sourceIds: ["wikipedia"] }]);
    expect(result.failures).toEqual([
      {
        name: "King Alexander",
        message: "Multiple Wikipedia links match this name; the identity is ambiguous.",
      },
    ]);
  });

  it("matches papal names and Unicode spaces and checks duplicate references only once", async () => {
    const repository = createRepository();
    const fetchedTitles: string[] = [];
    const progress: string[] = [];
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => {
        fetchedTitles.push(title);
        return snapshot(title, "Q1020");
      },
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });

    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [
        { name: "Pope Innocent X", sourceIds: ["wikipedia"] },
        { name: "Antonio Della Bitta", sourceIds: ["wikipedia"] },
        { name: "Pope Innocent X", sourceIds: ["other"] },
        { name: "Innocent\u202fX", sourceIds: ["wikipedia"] },
        { name: "Antonio Della Bitta", sourceIds: ["other"] },
      ],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia",
          title: "Piazza Navona",
          url: "https://en.wikipedia.org/wiki/Piazza_Navona",
          content: "Innocent X commissioned the piazza. Antonio Della Bitta sculpted Neptune.",
          links: [{ label: "Innocent\u00a0X", title: "Innocent X" }],
        },
      ],
      ai: { mode: "local", model: "person-model" },
      onProgress: (message) => progress.push(message),
    });

    expect(result).toEqual({
      relatedPeople: [
        { name: "Pope Innocent X", personId: "pope-innocent-x", sourceIds: ["wikipedia", "other"] },
      ],
      failures: [],
    });
    expect(fetchedTitles).toEqual(["Innocent X"]);
    expect(progress.filter((message) => message.startsWith("Checking "))).toEqual([
      "Checking Pope Innocent X (1/2).",
      "Checking Antonio Della Bitta (2/2).",
    ]);
  });

  it("preserves an existing Person ID when an unresolved duplicate comes first", async () => {
    const people = createPeople({
      repository: createRepository(),
      fetchSnapshot: async () => {
        throw new Error("Resolved People must not be fetched again.");
      },
    });

    await expect(
      people.resolveAndGenerateMissing({
        relatedPeople: [
          { name: "Pope Innocent X", sourceIds: ["wikipedia"] },
          { name: "Innocent X", personId: "innocent-x", sourceIds: ["other"] },
        ],
        storySources: [],
        ai: { mode: "local", model: "person-model" },
      }),
    ).resolves.toEqual({
      relatedPeople: [
        { name: "Pope Innocent X", personId: "innocent-x", sourceIds: ["wikipedia", "other"] },
      ],
      failures: [],
    });
  });

  it("leaves missing, ambiguous, and identity-less references unresolved", async () => {
    const repository = createRepository();
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => snapshot(title),
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });

    await expect(
      people.resolveAndGenerateMissing({
        relatedPeople: [
          { name: "Missing", sourceIds: ["wikipedia"] },
          { name: "Alexander", sourceIds: ["wikipedia"] },
          { name: "Known link", sourceIds: ["wikipedia"] },
        ],
        storySources: [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Example",
            url: "https://en.wikipedia.org/wiki/Example",
            content: "Story source",
            links: [
              { label: "Alexander", title: "Alexander the Great" },
              { label: "Alexander", title: "Alexander of Abonoteichus" },
              { label: "Missing", title: "Missing (artist)" },
              { label: "Missing", title: "Missing (architect)" },
              { label: "Known link", title: "Known link" },
            ],
          },
        ],
        ai: { mode: "local", model: "person-model" },
      }),
    ).resolves.toEqual({
      relatedPeople: [
        { name: "Missing", sourceIds: ["wikipedia"] },
        { name: "Alexander", sourceIds: ["wikipedia"] },
        { name: "Known link", sourceIds: ["wikipedia"] },
      ],
      failures: [
        {
          name: "Missing",
          message: "Multiple Wikipedia links match this name; the identity is ambiguous.",
        },
        {
          name: "Alexander",
          message: "Multiple Wikipedia links match this name; the identity is ambiguous.",
        },
        { name: "Known link", message: "The linked Wikipedia page has no Wikidata ID." },
      ],
    });
    expect(repository.list()).toEqual([]);
  });

  it("reuses one canonical Person for references with the same Wikidata ID", async () => {
    const repository = createRepository();
    let generationCount = 0;
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => snapshot(title, "Q100"),
      generateContent: async () => {
        generationCount += 1;
        return content;
      },
      fetchImageCandidates: async () => [],
    });

    const resolved = await people.resolveAndGenerateMissing({
      relatedPeople: [
        { name: "Heracles", sourceIds: ["wikipedia"] },
        { name: "Hercules", sourceIds: ["wikipedia"] },
      ],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia",
          title: "Example",
          url: "https://en.wikipedia.org/wiki/Example",
          content: "Story source",
          links: [
            { label: "Heracles", title: "Heracles" },
            { label: "Hercules", title: "Hercules" },
          ],
        },
      ],
      ai: { mode: "cloud", model: "person-model" },
    });

    expect(resolved).toEqual({
      relatedPeople: [
        { name: "Heracles", personId: "heracles", sourceIds: ["wikipedia"] },
        { name: "Hercules", personId: "heracles", sourceIds: ["wikipedia"] },
      ],
      failures: [],
    });
    expect(generationCount).toBe(1);
    expect(repository.list()).toHaveLength(1);
  });

  it("does not persist a partial Person when generation fails", async () => {
    const repository = createRepository();
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => snapshot(title, "Q100"),
      generateContent: async () => {
        throw new Error("AI unavailable");
      },
      fetchImageCandidates: async () => [image(true)],
    });

    await expect(
      people.resolveAndGenerateMissing({
        relatedPeople: [{ name: "Hercules", sourceIds: ["wikipedia"] }],
        storySources: [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Example",
            url: "https://en.wikipedia.org/wiki/Example",
            content: "Story source",
            links: [{ label: "Hercules", title: "Hercules" }],
          },
        ],
        ai: { mode: "local", model: "person-model" },
      }),
    ).resolves.toEqual({
      relatedPeople: [{ name: "Hercules", sourceIds: ["wikipedia"] }],
      failures: [{ name: "Hercules", message: "AI unavailable" }],
    });
    expect(repository.list()).toEqual([]);
  });

  it("resolves a Person without an optional image when image discovery is rate limited", async () => {
    const repository = createRepository();
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => snapshot(title, "Q100"),
      generateContent: async () => content,
      fetchImageCandidates: async () => {
        throw new Error("HTTP 429 Too Many Requests");
      },
    });

    await expect(
      people.resolveAndGenerateMissing({
        relatedPeople: [{ name: "Hercules", sourceIds: ["wikipedia"] }],
        storySources: [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Example",
            url: "https://en.wikipedia.org/wiki/Example",
            content: "Story source",
            links: [{ label: "Hercules", title: "Hercules" }],
          },
        ],
        ai: { mode: "local", model: "person-model" },
      }),
    ).resolves.toEqual({
      relatedPeople: [{ name: "Hercules", personId: "hercules", sourceIds: ["wikipedia"] }],
      failures: [],
    });
    expect(repository.get("hercules")?.image).toBeUndefined();
  });

  it("keeps existing resolutions and stops new requests after a rate limit", async () => {
    const repository = createRepository();
    const fetchedTitles: string[] = [];
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => {
        fetchedTitles.push(title);
        throw new Error("HTTP 429 Too Many Requests");
      },
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });

    await expect(
      people.resolveAndGenerateMissing({
        relatedPeople: [
          { name: "Resolved", personId: "resolved", sourceIds: ["wikipedia"] },
          { name: "Hercules", sourceIds: ["wikipedia"] },
          { name: "Romulus", sourceIds: ["wikipedia"] },
        ],
        storySources: [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Example",
            url: "https://en.wikipedia.org/wiki/Example",
            content: "Story source",
            links: [
              { label: "Hercules", title: "Hercules" },
              { label: "Romulus", title: "Romulus" },
            ],
          },
        ],
        ai: { mode: "cloud", model: "person-model" },
      }),
    ).resolves.toEqual({
      relatedPeople: [
        { name: "Resolved", personId: "resolved", sourceIds: ["wikipedia"] },
        { name: "Hercules", sourceIds: ["wikipedia"] },
        { name: "Romulus", sourceIds: ["wikipedia"] },
      ],
      failures: [
        { name: "Hercules", message: "HTTP 429 Too Many Requests" },
        { name: "Romulus", message: "HTTP 429 Too Many Requests" },
      ],
    });
    expect(fetchedTitles).toEqual(["Hercules"]);
  });
});
