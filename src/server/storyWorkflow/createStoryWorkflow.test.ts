import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { MainImageCandidate, PoiInput } from "@/server/wikiPipeline/types";
import {
  createStoryWorkflow,
  type StoryWorkflowDependencies,
  type StoryWorkflowRepository,
} from "./createStoryWorkflow";
import { StoryWorkflowError, type DraftStorySnapshot } from "./types";
import type { StoryContent } from "./storyContent";
import { filesystemStoryWorkflowRepository } from "./filesystemRepository";

const pointOfInterest: PoiInput = {
  id: "forum-boarium",
  name: "Forum Boarium",
  city: "Rome",
  coordinates: { lat: 41.889, lng: 12.481 },
  sourceHints: { wikidata: "Q152834" },
};

const source = {
  id: "wikipedia",
  kind: "wikipedia" as const,
  title: "Forum Boarium",
  url: "https://en.wikipedia.org/wiki/Forum_Boarium",
  content: "Source version one",
};

const storyContent = (introduction = "Forum Boarium was Rome's cattle market.") =>
  ({
    introduction: { text: introduction, sourceIds: ["wikipedia"] },
    topics: {
      history: [],
      design: [],
      art: [],
    },
    relatedPeople: [],
  }) satisfies StoryContent;

const candidate = (commonsFileName: string, metadata = true): MainImageCandidate => ({
  commonsFileName,
  commonsPageUrl: `https://commons.wikimedia.org/wiki/File:${commonsFileName}`,
  thumbnailUrl: `https://example.com/${commonsFileName}`,
  originalImageUrl: `https://example.com/original/${commonsFileName}`,
  license: metadata ? "CC BY-SA 4.0" : undefined,
  attribution: metadata ? "Example author" : undefined,
  discoveredVia: "wikidata-p18",
  isProposed: true,
});

const createMemoryRepository = () => {
  const snapshots = new Map<string, DraftStorySnapshot>();
  const getOrCreate = (poiId: string) => {
    const current = snapshots.get(poiId) ?? {
      poiId,
      sources: [],
      mainImageCandidates: [],
      generation: {},
    };
    snapshots.set(poiId, current);
    return current;
  };
  const repository: StoryWorkflowRepository = {
    get: async (poiId) => {
      const snapshot = snapshots.get(poiId);
      return snapshot ? structuredClone(snapshot) : undefined;
    },
    replaceSources: async (poiId, sources, checkpoint) => {
      const snapshot = getOrCreate(poiId);
      snapshot.sources = structuredClone(sources);
      snapshot.generation.sources = checkpoint;
    },
    replaceMainImageCandidates: async (poiId, candidates, selectedCommonsFileName, checkpoint) => {
      const snapshot = getOrCreate(poiId);
      snapshot.mainImageCandidates = structuredClone(candidates);
      snapshot.draftMainImage = candidates.find(
        (item) => item.commonsFileName === selectedCommonsFileName,
      );
      snapshot.generation.mainImageCandidates = checkpoint;
    },
    replaceStoryProse: async (poiId, storyProse, checkpoint) => {
      const snapshot = getOrCreate(poiId);
      snapshot.storyProse = storyProse;
      snapshot.generation.storyProse = checkpoint;
    },
    replaceStoryContent: async (poiId, content, checkpoint) => {
      const snapshot = getOrCreate(poiId);
      snapshot.storyContent = structuredClone(content);
      snapshot.generation.storyContent = checkpoint;
    },
    deleteStoryProse: async (poiId) => {
      const snapshot = snapshots.get(poiId);
      if (snapshot) {
        delete snapshot.storyProse;
        delete snapshot.generation.storyProse;
      }
    },
    deleteStoryContent: async (poiId) => {
      const snapshot = snapshots.get(poiId);
      if (snapshot) {
        delete snapshot.storyContent;
        delete snapshot.generation.storyContent;
      }
    },
    deleteMainImageCandidates: async (poiId) => {
      const snapshot = snapshots.get(poiId);
      if (snapshot) {
        snapshot.mainImageCandidates = [];
        delete snapshot.draftMainImage;
        delete snapshot.generation.mainImageCandidates;
      }
    },
    reset: async (poiId) => {
      snapshots.delete(poiId);
    },
  };
  return { repository, snapshots };
};

const createDependencies = (overrides: Partial<StoryWorkflowDependencies> = {}) => {
  const { repository, snapshots } = createMemoryRepository();
  return {
    dependencies: {
      findPointOfInterest: async (poiId) =>
        poiId === pointOfInterest.id ? pointOfInterest : undefined,
      acquireSources: async () => [source],
      generateMainImageCandidates: async () => [candidate("first.jpg")],
      generateStoryProse: async ({ sources }) => ({
        content: `Story from ${sources[0]?.content}`,
        provider: "ollama" as const,
      }),
      generateStoryContent: async () => ({
        content: storyContent(),
        provider: "ollama" as const,
      }),
      repository,
      now: () => new Date("2026-08-22T10:00:00.000Z"),
      ...overrides,
    } satisfies StoryWorkflowDependencies,
    repository,
    snapshots,
  };
};

describe("Story Workflow Interface", () => {
  it("owns the full generation order and returns a stable domain result", async () => {
    const order: string[] = [];
    const { dependencies } = createDependencies({
      acquireSources: async () => {
        order.push("sources");
        return [{ ...source, content: "Source" }];
      },
      generateMainImageCandidates: async () => {
        order.push("mainImageCandidates");
        return [candidate("first.jpg")];
      },
      generateStoryContent: async () => {
        order.push("storyContent");
        return { content: storyContent(), provider: "ollama" };
      },
    });

    await expect(
      createStoryWorkflow(dependencies).draftStory.generate({
        poiId: pointOfInterest.id,
        ai: { mode: "local", model: "qwen3:8b" },
      }),
    ).resolves.toEqual({
      poiId: pointOfInterest.id,
      mainImageCandidates: "generated",
      draftMainImage: "available",
      storyContent: "generated",
    });
    expect(order).toEqual(["sources", "mainImageCandidates", "storyContent"]);
  });

  it("stops before downstream work when Sources are unavailable", async () => {
    const downstream: string[] = [];
    const { dependencies, repository } = createDependencies({
      acquireSources: async () => {
        throw new Error("Wikipedia unavailable");
      },
      generateMainImageCandidates: async () => {
        downstream.push("candidates");
        return [];
      },
      generateStoryContent: async () => {
        downstream.push("content");
        return { content: storyContent(), provider: "ollama" };
      },
    });

    await expect(
      createStoryWorkflow(dependencies).draftStory.generate({
        poiId: pointOfInterest.id,
        ai: { mode: "local", model: "qwen3:8b" },
      }),
    ).rejects.toMatchObject({
      code: "sources-unavailable",
      stage: "sources",
      retryable: true,
    });
    expect(downstream).toEqual([]);
    expect(await repository.get(pointOfInterest.id)).toBeUndefined();
  });

  it("continues Story Content and reports partial success after candidate failure", async () => {
    const { dependencies, repository } = createDependencies({
      generateMainImageCandidates: async () => {
        throw new Error("Commons unavailable");
      },
    });
    const workflow = createStoryWorkflow(dependencies);

    await expect(
      workflow.draftStory.generate({
        poiId: pointOfInterest.id,
        ai: { mode: "local", model: "qwen3:8b" },
      }),
    ).resolves.toEqual({
      poiId: pointOfInterest.id,
      mainImageCandidates: "failed",
      draftMainImage: "missing",
      storyContent: "generated",
    });
    expect(await repository.get(pointOfInterest.id)).toMatchObject({
      sources: [{ content: "Source version one" }],
      mainImageCandidates: [],
      storyContent: storyContent(),
    });
  });

  it("preserves successful Source and candidate checkpoints when Story Content fails", async () => {
    const { dependencies, repository } = createDependencies({
      generateStoryContent: async () => {
        throw new Error("AI unavailable");
      },
    });

    await expect(
      createStoryWorkflow(dependencies).draftStory.generate({
        poiId: pointOfInterest.id,
        ai: { mode: "cloud", model: "gemini-2.5-flash" },
      }),
    ).rejects.toMatchObject({
      code: "story-content-generation-failed",
      stage: "storyContent",
    });
    expect(await repository.get(pointOfInterest.id)).toMatchObject({
      sources: [{ content: "Source version one" }],
      mainImageCandidates: [{ commonsFileName: "first.jpg" }],
      draftMainImage: { commonsFileName: "first.jpg" },
    });
  });

  it("uses create-or-replace semantics and preserves previous artifacts on explicit failure", async () => {
    let prose = "First story";
    let content = storyContent("First structured story.");
    let candidates = [candidate("first.jpg")];
    let failProse = false;
    let failContent = false;
    let failCandidates = false;
    const { dependencies, repository } = createDependencies({
      generateStoryProse: async () => {
        if (failProse) throw new Error("AI unavailable");
        return { content: prose, provider: "ollama" };
      },
      generateStoryContent: async () => {
        if (failContent) throw new Error("AI unavailable");
        return { content, provider: "ollama" };
      },
      generateMainImageCandidates: async () => {
        if (failCandidates) throw new Error("Commons unavailable");
        return candidates;
      },
    });
    const workflow = createStoryWorkflow(dependencies);
    await workflow.draftStory.generate({
      poiId: pointOfInterest.id,
      ai: { mode: "local", model: "qwen3:8b" },
    });

    prose = "Replacement story";
    content = storyContent("Replacement structured story.");
    candidates = [candidate("replacement.jpg")];
    await workflow.storyProse.generate({
      poiId: pointOfInterest.id,
      ai: { mode: "local", model: "qwen3:8b" },
    });
    await workflow.storyContent.generate({
      poiId: pointOfInterest.id,
      ai: { mode: "local", model: "qwen3:8b" },
    });
    await workflow.mainImageCandidates.generate({ poiId: pointOfInterest.id });
    expect(await repository.get(pointOfInterest.id)).toMatchObject({
      storyProse: "Replacement story",
      storyContent: content,
      mainImageCandidates: [{ commonsFileName: "replacement.jpg" }],
    });

    failProse = true;
    failContent = true;
    failCandidates = true;
    await expect(
      workflow.storyProse.generate({
        poiId: pointOfInterest.id,
        ai: { mode: "local", model: "qwen3:8b" },
      }),
    ).rejects.toBeInstanceOf(StoryWorkflowError);
    await expect(
      workflow.storyContent.generate({
        poiId: pointOfInterest.id,
        ai: { mode: "local", model: "qwen3:8b" },
      }),
    ).rejects.toMatchObject({ code: "story-content-generation-failed" });
    await expect(
      workflow.mainImageCandidates.generate({ poiId: pointOfInterest.id }),
    ).rejects.toMatchObject({
      code: "main-image-candidates-generation-failed",
    });
    expect(await repository.get(pointOfInterest.id)).toMatchObject({
      storyProse: "Replacement story",
      storyContent: content,
      mainImageCandidates: [{ commonsFileName: "replacement.jpg" }],
    });
  });

  it("preserves an eligible Draft Main Image and otherwise selects the first eligible candidate", async () => {
    let candidates = [candidate("kept.jpg"), candidate("fallback.jpg")];
    const { dependencies, repository } = createDependencies({
      generateMainImageCandidates: async () => candidates,
    });
    const workflow = createStoryWorkflow(dependencies);
    await workflow.draftStory.generate({
      poiId: pointOfInterest.id,
      ai: { mode: "local", model: "qwen3:8b" },
    });

    candidates = [candidate("fallback.jpg"), candidate("kept.jpg")];
    await workflow.mainImageCandidates.generate({ poiId: pointOfInterest.id });
    expect((await repository.get(pointOfInterest.id))?.draftMainImage?.commonsFileName).toBe(
      "kept.jpg",
    );

    candidates = [candidate("kept.jpg", false), candidate("fallback.jpg")];
    await workflow.mainImageCandidates.generate({ poiId: pointOfInterest.id });
    expect((await repository.get(pointOfInterest.id))?.draftMainImage?.commonsFileName).toBe(
      "fallback.jpg",
    );
  });

  it("deletes individual artifacts and resets all workflow-owned state", async () => {
    const { dependencies } = createDependencies();
    const workflow = createStoryWorkflow(dependencies);
    await workflow.draftStory.generate({
      poiId: pointOfInterest.id,
      ai: { mode: "local", model: "qwen3:8b" },
    });
    await workflow.storyProse.generate({
      poiId: pointOfInterest.id,
      ai: { mode: "local", model: "qwen3:8b" },
    });

    await workflow.storyProse.delete({ poiId: pointOfInterest.id });
    await workflow.storyContent.delete({ poiId: pointOfInterest.id });
    await workflow.mainImageCandidates.delete({ poiId: pointOfInterest.id });
    expect(await workflow.draftStory.get({ poiId: pointOfInterest.id })).toMatchObject({
      sources: [{ content: "Source version one" }],
      mainImageCandidates: [],
    });
    await workflow.draftStory.reset({ poiId: pointOfInterest.id });
    expect(await workflow.draftStory.get({ poiId: pointOfInterest.id })).toBeUndefined();
  });

  it("returns stable domain errors for missing POIs and persistence failures", async () => {
    const { dependencies, repository } = createDependencies();
    const workflow = createStoryWorkflow(dependencies);
    await expect(
      workflow.draftStory.generate({
        poiId: "missing",
        ai: { mode: "local", model: "qwen3:8b" },
      }),
    ).rejects.toMatchObject({
      code: "point-of-interest-not-found",
      retryable: false,
    });

    const persistenceFailureWorkflow = createStoryWorkflow({
      ...dependencies,
      repository: {
        ...repository,
        replaceSources: async () => {
          throw new Error("Disk full");
        },
      },
    });
    await expect(
      persistenceFailureWorkflow.draftStory.generate({
        poiId: pointOfInterest.id,
        ai: { mode: "local", model: "qwen3:8b" },
      }),
    ).rejects.toMatchObject({
      code: "persistence-failed",
      stage: "persistence",
      retryable: true,
    });
  });

  it("persists and resets workflow state through the public Interface in isolated storage", async () => {
    const originalWorkingDirectory = process.cwd();
    const temporaryDirectory = mkdtempSync(
      path.join(tmpdir(), "historical-explorer-story-workflow-"),
    );
    process.chdir(temporaryDirectory);
    try {
      const markdownFilePath = path.join(
        temporaryDirectory,
        "data/rome/stories/forum-boarium/story.md",
      );
      mkdirSync(path.dirname(markdownFilePath), { recursive: true });
      writeFileSync(markdownFilePath, "Existing independent Markdown\n", "utf-8");
      const workflow = createStoryWorkflow({
        ...createDependencies().dependencies,
        repository: filesystemStoryWorkflowRepository,
      });
      await workflow.draftStory.generate({
        poiId: pointOfInterest.id,
        ai: { mode: "local", model: "qwen3:8b" },
      });
      await expect(workflow.draftStory.get({ poiId: pointOfInterest.id })).resolves.toMatchObject({
        poiId: pointOfInterest.id,
        sources: [{ content: "Source version one" }],
        storyContent: storyContent(),
        mainImageCandidates: [{ commonsFileName: "first.jpg" }],
        draftMainImage: { commonsFileName: "first.jpg" },
      });
      expect(readFileSync(markdownFilePath, "utf-8")).toBe("Existing independent Markdown\n");

      unlinkSync(path.join(temporaryDirectory, "data/rome/generated/wiki/forum-boarium.txt"));
      unlinkSync(
        path.join(temporaryDirectory, "data/rome/generated/wiki/forum-boarium.metadata.json"),
      );
      await expect(workflow.draftStory.get({ poiId: pointOfInterest.id })).resolves.toMatchObject({
        sources: [],
        storyContent: storyContent(),
        storyProse: "Existing independent Markdown",
      });

      await workflow.draftStory.reset({ poiId: pointOfInterest.id });
      await expect(workflow.draftStory.get({ poiId: pointOfInterest.id })).resolves.toBeUndefined();
    } finally {
      process.chdir(originalWorkingDirectory);
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
