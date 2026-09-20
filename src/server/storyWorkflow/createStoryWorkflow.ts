import type { MainImageCandidate, PoiInput } from "@/server/wikiPipeline/types";
import type { StoryContent } from "./storyContent";
import {
  StoryWorkflowError,
  type AiSelection,
  type DraftStoryGenerationStatus,
  type DraftStorySnapshot,
  type RelatedPeopleResolutionResult,
  type Source,
  type StoryWorkflow,
} from "./types";

export type StoryWorkflowRepository = {
  get(poiId: string): Promise<DraftStorySnapshot | undefined>;
  replaceSources(
    poiId: string,
    sources: Source[],
    checkpoint: NonNullable<DraftStoryGenerationStatus["sources"]>,
  ): Promise<void>;
  replaceMainImageCandidates(
    poiId: string,
    candidates: MainImageCandidate[],
    selectedCommonsFileName: string | undefined,
    checkpoint: NonNullable<DraftStoryGenerationStatus["mainImageCandidates"]>,
  ): Promise<void>;
  replaceStoryContent(
    poiId: string,
    storyContent: StoryContent,
    checkpoint: NonNullable<DraftStoryGenerationStatus["storyContent"]>,
    relatedPeopleCheckpoint?: NonNullable<DraftStoryGenerationStatus["relatedPeople"]>,
  ): Promise<void>;
  selectDraftMainImage(poiId: string, commonsFileName: string): Promise<void>;
  deleteStoryContent(poiId: string): Promise<void>;
  deleteMainImageCandidates(poiId: string): Promise<void>;
  reset(poiId: string): Promise<void>;
};

export type StoryWorkflowDependencies = {
  findPointOfInterest(poiId: string): Promise<PoiInput | undefined>;
  acquireSources(pointOfInterest: PoiInput, previousSources?: Source[]): Promise<Source[]>;
  generateMainImageCandidates(pointOfInterest: PoiInput): Promise<MainImageCandidate[]>;
  generateStoryContent(input: {
    pointOfInterest: PoiInput;
    sources: Source[];
    ai: AiSelection;
  }): Promise<{ content: StoryContent; provider: "ollama" | "gemini" }>;
  resolveRelatedPeople(input: {
    relatedPeople: StoryContent["relatedPeople"];
    sources: Source[];
    ai: AiSelection;
  }): Promise<RelatedPeopleResolutionResult>;
  repository: StoryWorkflowRepository;
  now?: () => Date;
};

const toCheckpoint = (startedAt: number, now: () => Date) => ({
  durationMs: now().getTime() - startedAt,
  completedAt: now().toISOString(),
});

const persistenceError = (cause: unknown) =>
  new StoryWorkflowError({
    code: "persistence-failed",
    stage: "persistence",
    retryable: true,
    cause,
  });

const findPointOfInterest = async (poiId: string, dependencies: StoryWorkflowDependencies) => {
  const pointOfInterest = await dependencies.findPointOfInterest(poiId);
  if (!pointOfInterest) {
    throw new StoryWorkflowError({
      code: "point-of-interest-not-found",
      stage: "sources",
      retryable: false,
    });
  }

  return pointOfInterest;
};

const selectDraftMainImage = (candidates: MainImageCandidate[], currentCommonsFileName?: string) =>
  candidates.find(
    (candidate) =>
      candidate.commonsFileName === currentCommonsFileName &&
      candidate.license &&
      candidate.attribution,
  )?.commonsFileName ??
  candidates.find((candidate) => candidate.license && candidate.attribution)?.commonsFileName;

export const createStoryWorkflow = (dependencies: StoryWorkflowDependencies): StoryWorkflow => {
  const now = dependencies.now ?? (() => new Date());

  const acquireAndPersistSources = async (
    pointOfInterest: PoiInput,
    previousSources?: Source[],
  ) => {
    const startedAt = now().getTime();
    let sources: Source[];
    try {
      sources = await dependencies.acquireSources(pointOfInterest, previousSources);
      if (sources.length === 0 || sources.some((source) => !source.content.trim())) {
        throw new Error("No usable sources were returned.");
      }
    } catch (cause) {
      console.error(`[sources] Acquisition failed for ${pointOfInterest.id}.`, cause);
      throw new StoryWorkflowError({
        code: "sources-unavailable",
        stage: "sources",
        retryable: true,
        cause,
      });
    }

    try {
      await dependencies.repository.replaceSources(
        pointOfInterest.id,
        sources,
        toCheckpoint(startedAt, now),
      );
    } catch (cause) {
      throw persistenceError(cause);
    }

    return sources;
  };

  const generateAndPersistCandidates = async (pointOfInterest: PoiInput) => {
    const startedAt = now().getTime();
    const previous = await dependencies.repository.get(pointOfInterest.id);
    let candidates: MainImageCandidate[];
    try {
      candidates = await dependencies.generateMainImageCandidates(pointOfInterest);
    } catch (cause) {
      throw new StoryWorkflowError({
        code: "main-image-candidates-generation-failed",
        stage: "mainImageCandidates",
        retryable: true,
        cause,
      });
    }

    const selectedCommonsFileName = selectDraftMainImage(
      candidates,
      previous?.draftMainImage?.commonsFileName,
    );
    try {
      await dependencies.repository.replaceMainImageCandidates(
        pointOfInterest.id,
        candidates,
        selectedCommonsFileName,
        toCheckpoint(startedAt, now),
      );
    } catch (cause) {
      throw persistenceError(cause);
    }

    return selectedCommonsFileName;
  };

  const generateAndPersistStoryContent = async (
    pointOfInterest: PoiInput,
    sources: Source[],
    ai: AiSelection,
  ) => {
    const startedAt = now().getTime();
    let generated: { content: StoryContent; provider: "ollama" | "gemini" };
    try {
      generated = await dependencies.generateStoryContent({
        pointOfInterest,
        sources,
        ai,
      });
    } catch (cause) {
      throw new StoryWorkflowError({
        code: "story-content-generation-failed",
        stage: "storyContent",
        retryable: true,
        cause,
      });
    }
    const storyContentCheckpoint = {
      ...toCheckpoint(startedAt, now),
      aiMode: ai.mode,
      aiProvider: generated.provider,
      aiModel: ai.model,
    };

    const relatedPeopleStartedAt = now().getTime();
    let resolution: RelatedPeopleResolutionResult;
    try {
      resolution = await dependencies.resolveRelatedPeople({
        relatedPeople: generated.content.relatedPeople,
        sources,
        ai,
      });
      generated.content.relatedPeople = resolution.relatedPeople;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.warn(`[related-people] Resolution failed for ${pointOfInterest.id}.`, cause);
      resolution = {
        relatedPeople: generated.content.relatedPeople,
        failures: generated.content.relatedPeople
          .filter(({ personId }) => !personId)
          .map(({ name }) => ({ name, message })),
      };
    }

    try {
      await dependencies.repository.replaceStoryContent(
        pointOfInterest.id,
        generated.content,
        storyContentCheckpoint,
        {
          ...toCheckpoint(relatedPeopleStartedAt, now),
          aiMode: ai.mode,
          aiProvider: generated.provider,
          aiModel: ai.model,
        },
      );
    } catch (cause) {
      throw persistenceError(cause);
    }

    return resolution;
  };

  return {
    draftStory: {
      generate: async ({ poiId, ai }) => {
        const pointOfInterest = await findPointOfInterest(poiId, dependencies);
        const sources = await acquireAndPersistSources(
          pointOfInterest,
          (await dependencies.repository.get(poiId))?.sources,
        );
        let mainImageCandidates: "generated" | "failed" = "generated";
        let selectedCommonsFileName: string | undefined;
        try {
          selectedCommonsFileName = await generateAndPersistCandidates(pointOfInterest);
        } catch (error) {
          if (
            !(error instanceof StoryWorkflowError) ||
            error.code !== "main-image-candidates-generation-failed"
          ) {
            throw error;
          }
          mainImageCandidates = "failed";
          selectedCommonsFileName = (await dependencies.repository.get(poiId))?.draftMainImage
            ?.commonsFileName;
        }
        const relatedPeople = await generateAndPersistStoryContent(pointOfInterest, sources, ai);

        return {
          poiId,
          mainImageCandidates,
          draftMainImage: selectedCommonsFileName ? "available" : "missing",
          storyContent: "generated",
          relatedPeople: relatedPeople.failures.length > 0 ? "partial" : "resolved",
          relatedPeopleFailures: relatedPeople.failures,
        };
      },
      get: ({ poiId }) => dependencies.repository.get(poiId),
      reset: async ({ poiId }) => {
        try {
          await dependencies.repository.reset(poiId);
        } catch (cause) {
          throw persistenceError(cause);
        }
      },
    },
    storyContent: {
      generate: async ({ poiId, ai }) => {
        const pointOfInterest = await findPointOfInterest(poiId, dependencies);
        const sources = await acquireAndPersistSources(
          pointOfInterest,
          (await dependencies.repository.get(poiId))?.sources,
        );
        return generateAndPersistStoryContent(pointOfInterest, sources, ai);
      },
      delete: async ({ poiId }) => {
        try {
          await dependencies.repository.deleteStoryContent(poiId);
        } catch (cause) {
          throw persistenceError(cause);
        }
      },
    },
    relatedPeople: {
      resolve: async ({ poiId, ai }) => {
        const startedAt = now().getTime();
        const snapshot = await dependencies.repository.get(poiId);
        if (!snapshot?.storyContent || snapshot.sources.length === 0) {
          throw new StoryWorkflowError({
            code: "sources-unavailable",
            stage: "sources",
            retryable: true,
          });
        }
        const resolution = await dependencies.resolveRelatedPeople({
          relatedPeople: snapshot.storyContent.relatedPeople,
          sources: snapshot.sources,
          ai,
        });
        try {
          await dependencies.repository.replaceStoryContent(
            poiId,
            { ...snapshot.storyContent, relatedPeople: resolution.relatedPeople },
            snapshot.generation.storyContent ?? {
              durationMs: 0,
              completedAt: now().toISOString(),
            },
            {
              ...toCheckpoint(startedAt, now),
              aiMode: ai.mode,
              aiModel: ai.model,
            },
          );
        } catch (cause) {
          throw persistenceError(cause);
        }
        return resolution;
      },
    },
    mainImageCandidates: {
      generate: async ({ poiId }) => {
        await generateAndPersistCandidates(await findPointOfInterest(poiId, dependencies));
      },
      delete: async ({ poiId }) => {
        try {
          await dependencies.repository.deleteMainImageCandidates(poiId);
        } catch (cause) {
          throw persistenceError(cause);
        }
      },
    },
  };
};
