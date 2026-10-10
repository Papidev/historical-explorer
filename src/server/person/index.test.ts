import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MainImageCandidate, WikiSnapshot } from "@/server/wikiPipeline/types";
import { createFilesystemPersonRepository } from "./filesystemRepository";
import { createPeople, getSourceLinkIssue } from ".";
import type { Source } from "@/server/storyWorkflow";
import type { PersonContent } from "./types";

const directories: string[] = [];

const createRepository = (...existingIds: string[]) => {
  const directory = mkdtempSync(path.join(tmpdir(), "people-"));
  directories.push(directory);
  const repository = createFilesystemPersonRepository(directory);
  for (const id of existingIds) {
    const source = {
      id: "wikipedia",
      kind: "wikipedia" as const,
      title: id,
      url: `https://en.wikipedia.org/wiki/${id}`,
      content: "Stored source",
    };
    repository.replace(
      {
        id,
        name: id,
        wikidataId: `Q-${id}`,
        wikipediaTitle: id,
        content,
        source,
        generation: {
          aiMode: "local",
          aiProvider: "ollama",
          aiModel: "test-model",
          completedAt: "2026-09-19T10:00:00.000Z",
        },
      },
      source,
    );
  }
  return repository;
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
  it("regenerates saved content while preserving identity, image, and source", async () => {
    const repository = createRepository("hercules");
    const original = repository.get("hercules")!;
    repository.replace({ ...original, image: image(true) }, repository.readSource(original));
    const people = createPeople({
      repository,
      now: () => new Date("2026-10-03T10:00:00.000Z"),
      generateContent: async (person, sources, config) => {
        expect(person.wikidataId).toBe(original.wikidataId);
        expect(sources[0].content).toBe("Stored source");
        expect(config).toEqual({ mode: "local", provider: "ollama", model: "new-model" });
        return { ...content, curiosities: [] };
      },
    });
    await people.regenerate({ personId: "hercules", ai: { mode: "local", model: "new-model" } });
    expect(repository.list()).toHaveLength(1);
    expect(repository.get("hercules")).toEqual({
      ...original,
      image: image(true),
      content: { ...content, curiosities: [] },
      generation: {
        aiMode: "local",
        aiProvider: "ollama",
        aiModel: "new-model",
        completedAt: "2026-10-03T10:00:00.000Z",
      },
    });
    expect(repository.readSource(repository.get("hercules")!).content).toBe("Stored source");
  });

  it("keeps the saved Person after a failed regeneration and allows retry", async () => {
    const repository = createRepository("hercules");
    const original = repository.get("hercules");
    let fail = true;
    const people = createPeople({
      repository,
      generateContent: async () => {
        if (fail) throw new Error("Generation failed");
        return { ...content, curiosities: [] };
      },
    });
    await expect(
      people.regenerate({ personId: "hercules", ai: { mode: "local", model: "test-model" } }),
    ).rejects.toThrow("Generation failed");
    expect(repository.get("hercules")).toEqual(original);
    fail = false;
    await people.regenerate({ personId: "hercules", ai: { mode: "local", model: "test-model" } });
    expect(repository.get("hercules")?.content.curiosities).toEqual([]);
  });

  it("keeps the Italian edition for Related People links and their saved source", async () => {
    const repository = createRepository();
    const people = createPeople({
      repository,
      fetchSnapshot: async (title, language) => {
        expect(title).toBe("Galileo Galilei");
        expect(language).toBe("it");
        return { ...snapshot(title, "Q307"), language: "it" };
      },
      generateContent: async (_person, sources) => {
        expect(sources[0].url).toBe("https://it.wikipedia.org/wiki/Galileo_Galilei");
        return content;
      },
      fetchImageCandidates: async (input) => {
        expect(input.sourceHints.wikipedia).toBe("it:Galileo Galilei");
        return [];
      },
    });
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [{ name: "Galileo Galilei", sourceIds: ["wikipedia"] }],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia",
          title: "Example",
          url: "https://it.wikipedia.org/wiki/Example",
          content: "Source",
          links: [{ label: "Galileo Galilei", title: "Galileo Galilei", language: "it" }],
        },
      ],
      ai: { mode: "local", model: "test-model" },
    });
    expect(result.failures).toEqual([]);
    expect(result.relatedPeople[0].personId).toBe("galileo-galilei");
    expect(repository.get("galileo-galilei")?.source.url).toBe(
      "https://it.wikipedia.org/wiki/Galileo_Galilei",
    );
  });

  it("shares one pending generation between concurrent Stories and releases failures", async () => {
    const repository = createRepository();
    let generations = 0;
    const people = createPeople({
      repository,
      fetchSnapshot: async () => snapshot("Hercules", "Q123"),
      generateContent: async () => {
        generations += 1;
        if (generations === 1) throw new Error("Provider unavailable");
        return content;
      },
      fetchImageCandidates: async () => [],
    });
    const input = {
      relatedPeople: [{ name: "Hercules", sourceIds: ["wikipedia"] }],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia" as const,
          title: "Story",
          url: "https://en.wikipedia.org/wiki/Story",
          content: "Source",
          links: [{ label: "Hercules", title: "Hercules" }],
        },
      ],
      ai: { mode: "cloud" as const, model: "test-model" },
    };
    const failed = await Promise.all([
      people.resolveAndGenerateMissing(input),
      people.resolveAndGenerateMissing(input),
    ]);
    expect(generations).toBe(1);
    expect(failed.every(({ failures }) => failures.length === 1)).toBe(true);
    const resolved = await Promise.all([
      people.resolveAndGenerateMissing(input),
      people.resolveAndGenerateMissing(input),
    ]);
    expect(generations).toBe(2);
    expect(repository.list()).toHaveLength(1);
    expect(resolved.map(({ relatedPeople }) => relatedPeople[0].personId)).toEqual([
      "hercules",
      "hercules",
    ]);
  });

  it("allocates distinct IDs when different People with the same name finish concurrently", async () => {
    const repository = createRepository();
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => snapshot(title, title.endsWith("architect)") ? "Q1" : "Q2"),
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });
    await Promise.all(
      ["John Smith (architect)", "John Smith (artist)"].map((title) =>
        people.resolveAndGenerateMissing({
          relatedPeople: [{ name: "John Smith", sourceIds: ["wikipedia"] }],
          storySources: [
            {
              id: "wikipedia",
              kind: "wikipedia",
              title: "Story",
              url: "https://en.wikipedia.org/wiki/Story",
              content: "Source",
              links: [{ label: "John Smith", title }],
            },
          ],
          ai: { mode: "cloud", model: "test-model" },
        }),
      ),
    );
    expect(
      repository
        .list()
        .map(({ id }) => id)
        .sort(),
    ).toEqual(["john-smith", "john-smith-2"]);
    expect(new Set(repository.list().map(({ wikidataId }) => wikidataId)).size).toBe(2);
  });

  it("merges source links redirected to the same canonical Wikipedia article", async () => {
    const repository = createRepository();
    const people = createPeople({
      repository,
      fetchSnapshot: async () => snapshot("John Smith (architect)", "Q100"),
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [{ name: "John Smith", sourceIds: ["wikipedia"] }],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia",
          title: "Example",
          url: "https://en.wikipedia.org/wiki/Example",
          content: "Source text",
          links: [
            { label: "John Smith", title: "John Smith" },
            { label: "John Smith", title: "John Smith (architect)" },
          ],
        },
      ],
      ai: { mode: "local", model: "person-model" },
    });
    expect(result.failures).toEqual([]);
    expect(repository.get(result.relatedPeople[0].personId!)?.wikipediaTitle).toBe(
      "John Smith (architect)",
    );
    expect(repository.list()).toHaveLength(1);
  });

  it("does not create a Person from a disambiguation page alone", async () => {
    const repository = createRepository();
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => ({ ...snapshot(title, "Q100"), isDisambiguation: true }),
      generateContent: async () => {
        throw new Error("A disambiguation page is not a Person.");
      },
    });
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [{ name: "John Smith", sourceIds: ["wikipedia"] }],
      storySources: [
        {
          id: "wikipedia",
          kind: "wikipedia",
          title: "Example",
          url: "https://en.wikipedia.org/wiki/Example",
          content: "Source text",
          links: [{ label: "John Smith", title: "John Smith" }],
        },
      ],
      ai: { mode: "local", model: "person-model" },
    });
    expect(result).toEqual({ relatedPeople: [], failures: [] });
    expect(repository.list()).toHaveLength(0);
  });
  it.each([
    ["Quintus Marcius Rex", "Quintus Marcius Rex (praetor 144 BC)"],
    ["John Smith", "John Smith (architect)"],
  ])(
    "ignores the disambiguation page when one sourced Person remains for %s",
    async (name, title) => {
      const repository = createRepository();
      const fetchedTitles: string[] = [];
      const people = createPeople({
        repository,
        fetchSnapshot: async (requestedTitle) => {
          fetchedTitles.push(requestedTitle);
          return {
            ...snapshot(requestedTitle, requestedTitle === title ? "Q100" : "Q200"),
            ...(requestedTitle === name ? { isDisambiguation: true } : {}),
          };
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
            links: [
              { label: name, title: name },
              { label: name, title },
            ],
          },
        ],
        ai: { mode: "local", model: "person-model" },
      });
      expect(result.failures).toEqual([]);
      expect(fetchedTitles).toEqual([name, title]);
      expect(repository.get(result.relatedPeople[0].personId!)).toMatchObject({
        name,
        wikipediaTitle: title,
        wikidataId: "Q100",
      });
    },
  );
  it.each([
    ["Decimus Junius Brutus Scaeva (consul 292)", "Decimus Junius Brutus Scaeva"],
    ["John Smith (architect)", "John Smith"],
  ])("separates the display name from Wikipedia identity for %s", async (title, name) => {
    const repository = createRepository();
    let requestedName: string | undefined;
    const people = createPeople({
      repository,
      fetchSnapshot: async (requestedTitle) => {
        expect(requestedTitle).toBe(title);
        return snapshot(title, "Q100");
      },
      generateContent: async (person) => {
        requestedName = person.name;
        return content;
      },
      fetchImageCandidates: async () => [],
    });
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [{ name: title, sourceIds: ["wikipedia"] }],
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
    expect(requestedName).toBe(name);
    const id = result.relatedPeople[0].personId!;
    expect(repository.get(id)).toMatchObject({ name, wikipediaTitle: title, source: { title } });
    expect(people.getPublic(id)?.name).toBe(name);
    const stored = repository.get(id)!;
    repository.replace({ ...stored, name: title }, repository.readSource(stored));
    expect(people.getPublic(id)?.name).toBe(name);
  });
  it("resolves a saved reference again when its Person ID has no stored Person", async () => {
    const repository = createRepository();
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => snapshot(title, "Q100"),
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [{ name: "Hercules", personId: "Hercules", sourceIds: ["wikipedia"] }],
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
    });
    expect(result.relatedPeople[0].personId).toBe("hercules");
    expect(repository.get("hercules")).toBeDefined();
  });
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
    const storySources: Source[] = [
      {
        id: "wikipedia",
        kind: "wikipedia",
        title: "Example",
        url: "https://en.wikipedia.org/wiki/Example",
        content: "Source text",
        links: [{ label: title, title }],
      },
    ];
    expect(getSourceLinkIssue(name, storySources)).toBeUndefined();
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [{ name, sourceIds: ["wikipedia"] }],
      storySources,
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
      repository: createRepository("smith-artist", "smith-explorer"),
      fetchSnapshot: async (title) => {
        fetchedTitles.push(title);
        return snapshot(title, "Q100");
      },
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });
    const storySources: Source[] = [
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
    ];
    expect(getSourceLinkIssue("John Smith (architect)", storySources)).toBeUndefined();
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [
        { name: "John Smith (architect)", sourceIds: ["wikipedia"] },
        { name: "John Smith", personId: "smith-artist", sourceIds: ["wikipedia"] },
        { name: "John Smith", personId: "smith-explorer", sourceIds: ["wikipedia"] },
      ],
      storySources,
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
      fetchSnapshot: async (title) => snapshot(title, title === "Alexander I" ? "Q100" : "Q101"),
    });
    const storySources: Source[] = [
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
    ];
    expect(getSourceLinkIssue("King Alexander", storySources)).toBe(
      "Multiple Wikipedia links match this name in the current Story source.",
    );
    expect(getSourceLinkIssue("Newton", storySources)).toBe(
      "No matching Wikipedia link exists in the current Story source.",
    );
    expect(getSourceLinkIssue("Newton", [])).toBeUndefined();
    const result = await people.resolveAndGenerateMissing({
      relatedPeople: [
        { name: "King Alexander", sourceIds: ["wikipedia"] },
        { name: "Newton", sourceIds: ["wikipedia"] },
      ],
      storySources,
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
    const progress: string[] = [];
    const people = createPeople({
      repository: createRepository("innocent-x"),
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
        onProgress: (message) => progress.push(message),
      }),
    ).resolves.toEqual({
      relatedPeople: [
        { name: "Pope Innocent X", personId: "innocent-x", sourceIds: ["wikipedia", "other"] },
      ],
      failures: [],
    });
    expect(progress).toEqual(["Skipping Pope Innocent X (1/1): already resolved."]);
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

  it("excludes a Person whose Wikipedia page does not exist and continues with the remaining People", async () => {
    const repository = createRepository();
    const progress: string[] = [];
    const people = createPeople({
      repository,
      fetchSnapshot: async (title) => {
        if (title === "Alfredo Energici")
          throw new Error(`Wikipedia page not found for title "${title}".`);
        return snapshot(title, "Q100");
      },
      generateContent: async () => content,
      fetchImageCandidates: async () => [],
    });

    await expect(
      people.resolveAndGenerateMissing({
        relatedPeople: [
          { name: "Alfredo Energici", sourceIds: ["wikipedia"] },
          { name: "Hercules", sourceIds: ["wikipedia"] },
        ],
        storySources: [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Example",
            url: "https://en.wikipedia.org/wiki/Example",
            content: "Source text",
            links: [
              { label: "Alfredo Energici", title: "Alfredo Energici" },
              { label: "Hercules", title: "Hercules" },
            ],
          },
        ],
        ai: { mode: "local", model: "person-model" },
        onProgress: (message) => progress.push(message),
      }),
    ).resolves.toEqual({
      relatedPeople: [{ name: "Hercules", personId: "hercules", sourceIds: ["wikipedia"] }],
      failures: [],
    });
    expect(repository.list()).toHaveLength(1);
    expect(progress).toContain("Skipping Alfredo Energici: Wikipedia page not found.");
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
    const repository = createRepository("resolved");
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
