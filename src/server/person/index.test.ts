import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("People", () => {
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
      relatedPeople: [
        { name: "Hercules", personId: "hercules", sourceIds: ["wikipedia"] },
      ],
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
      failures: [],
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
