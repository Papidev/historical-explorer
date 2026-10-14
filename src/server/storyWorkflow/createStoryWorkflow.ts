import { throwIfGenerationCancelled } from "@/server/generationCancellation";
import type { MainImageCandidate, PoiInput, WikipediaLanguage } from "@/server/wikiPipeline/types";
import { WikipediaSourceMissingError } from "@/server/wikiPipeline/resolve";
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
  reset(poiId: string, sourceMissing?: boolean): Promise<void>;
};

export type StoryWorkflowDependencies = {
  findPointOfInterest(poiId: string): Promise<PoiInput | undefined>;
  acquireSources(
    pointOfInterest: PoiInput,
    previousSources?: Source[],
  ): Promise<Source[] | { sources: Source[]; warnings: string[] }>;
  generateMainImageCandidates(
    pointOfInterest: PoiInput,
    wikipediaTitle?: string,
    wikipediaLanguage?: WikipediaLanguage,
  ): Promise<MainImageCandidate[]>;
  generateStoryContent(input: {
    pointOfInterest: PoiInput;
    sources: Source[];
    ai: AiSelection;
  }): Promise<{ content: StoryContent; provider: "ollama" | "gemini" }>;
  resolveRelatedPeople(input: {
    relatedPeople: StoryContent["relatedPeople"];
    sources: Source[];
    ai: AiSelection;
    onProgress?: (message: string) => void;
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
    onProgress?: (message: string) => void,
  ) => {
    const startedAt = now().getTime();
    let sources: Source[];
    let warnings: string[] = [];
    try {
      const acquired = await dependencies.acquireSources(pointOfInterest, previousSources);
      sources = Array.isArray(acquired) ? acquired : acquired.sources;
      warnings = Array.isArray(acquired) ? [] : acquired.warnings;
      warnings.forEach((warning) => onProgress?.(warning));
      if (sources.length === 0 || sources.some((source) => !source.content.trim())) {
        throw new Error("No usable sources were returned.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throwIfGenerationCancelled();
      console.error(`[sources] Acquisition failed for ${pointOfInterest.id}.`, cause);
      throw new StoryWorkflowError({
        code:
          cause instanceof WikipediaSourceMissingError ? "source-not-found" : "sources-unavailable",
        stage: "sources",
        retryable: !(cause instanceof WikipediaSourceMissingError),
        cause,
      });
    }

    try {
      await dependencies.repository.replaceSources(pointOfInterest.id, sources, {
        ...toCheckpoint(startedAt, now),
        ...(warnings.length ? { sourceWarnings: warnings } : {}),
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throwIfGenerationCancelled();
      throw persistenceError(cause);
    }

    return sources;
  };

  const generateAndPersistCandidates = async (pointOfInterest: PoiInput, sources?: Source[]) => {
    const startedAt = now().getTime();
    const previous = await dependencies.repository.get(pointOfInterest.id);
    let candidates: MainImageCandidate[];
    try {
      const source = (sources ?? previous?.sources)?.find(({ kind }) => kind === "wikipedia");
      candidates = await dependencies.generateMainImageCandidates(
        pointOfInterest,
        source?.title,
        source ? new URL(source.url).hostname.split(".")[0] : "en",
      );
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throwIfGenerationCancelled();
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
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throwIfGenerationCancelled();
      throw persistenceError(cause);
    }

    return selectedCommonsFileName;
  };

  const generateAndPersistStoryContent = async (
    pointOfInterest: PoiInput,
    sources: Source[],
    ai: AiSelection,
    onProgress?: (message: string) => void,
  ) => {
    const startedAt = now().getTime();
    let generated: { content: StoryContent; provider: "ollama" | "gemini" };
    try {
      onProgress?.(`Generating Story Content with ${ai.model}.`);
      generated = await dependencies.generateStoryContent({
        pointOfInterest,
        sources,
        ai,
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throwIfGenerationCancelled();
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

    // Save the generated Story before resolving People so a stopped run can resume here.
    throwIfGenerationCancelled();
    try {
      await dependencies.repository.replaceStoryContent(
        pointOfInterest.id,
        generated.content,
        storyContentCheckpoint,
      );
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throwIfGenerationCancelled();
      throw persistenceError(cause);
    }

    const relatedPeopleStartedAt = now().getTime();
    let resolution: RelatedPeopleResolutionResult;
    try {
      onProgress?.(`Resolving ${generated.content.relatedPeople.length} Related People.`);
      resolution = await dependencies.resolveRelatedPeople({
        relatedPeople: generated.content.relatedPeople,
        sources,
        ai,
        onProgress,
      });
      generated.content.relatedPeople = resolution.relatedPeople;
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throwIfGenerationCancelled();
      const message = cause instanceof Error ? cause.message : String(cause);
      console.warn(`[related-people] Resolution failed for ${pointOfInterest.id}.`, cause);
      onProgress?.("Related People resolution failed.");
      resolution = {
        relatedPeople: generated.content.relatedPeople,
        failures: generated.content.relatedPeople
          .filter(({ personId }) => !personId)
          .map(({ name }) => ({ name, message })),
      };
    }

    throwIfGenerationCancelled();
    onProgress?.("Saving Story Content and Related People.");
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
          relatedPeopleFailures: resolution.failures,
          ...(resolution.sourceWarnings?.length
            ? { sourceWarnings: resolution.sourceWarnings }
            : {}),
        },
      );
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") throw cause;
      throwIfGenerationCancelled();
      throw persistenceError(cause);
    }

    return resolution;
  };

  const workflow: StoryWorkflow = {
    draftStory: {
      generate: async ({
        poiId,
        ai,
        onProgress,
        onSourcesAcquired,
        onStoryContentStarted,
        resume,
      }) => {
        const saved = resume ? await dependencies.repository.get(poiId) : undefined;
        onProgress?.("Finding the Point of Interest.");
        let pointOfInterest = await findPointOfInterest(poiId, dependencies);
        onProgress?.("Fetching Wikipedia Sources.");
        let sources: Source[];
        try {
          sources = saved?.sources.length
            ? saved.sources
            : await acquireAndPersistSources(pointOfInterest, undefined, onProgress);
        } catch (error) {
          throwIfGenerationCancelled();
          if (error instanceof StoryWorkflowError && error.code === "source-not-found") {
            try {
              await dependencies.repository.reset(poiId, true);
            } catch (cause) {
              if (cause instanceof Error && cause.name === "AbortError") throw cause;
              throwIfGenerationCancelled();
              throw persistenceError(cause);
            }
          }
          throw error;
        }
        if (onSourcesAcquired) {
          await onSourcesAcquired(sources);
          pointOfInterest = await findPointOfInterest(poiId, dependencies);
        }
        let mainImageCandidates: "generated" | "failed" = "generated";
        let mainImageCandidatesError: string | undefined;
        let selectedCommonsFileName: string | undefined;
        try {
          onProgress?.("Finding Main Image Candidates.");
          selectedCommonsFileName = saved?.generation.mainImageCandidates
            ? saved.draftMainImage?.commonsFileName
            : await generateAndPersistCandidates(pointOfInterest, sources);
        } catch (error) {
          throwIfGenerationCancelled();
          if (
            !(error instanceof StoryWorkflowError) ||
            error.code !== "main-image-candidates-generation-failed"
          ) {
            throw error;
          }
          mainImageCandidates = "failed";
          mainImageCandidatesError = error.message;
          onProgress?.("Main Image Candidates could not be refreshed; continuing.");
          selectedCommonsFileName = (await dependencies.repository.get(poiId))?.draftMainImage
            ?.commonsFileName;
        }
        if (!saved?.storyContent) onStoryContentStarted?.();
        const relatedPeople = saved?.storyContent
          ? await workflow.relatedPeople.resolve({ poiId, ai, onProgress })
          : await generateAndPersistStoryContent(pointOfInterest, sources, ai, onProgress);

        const sourceWarnings = [
          ...((await dependencies.repository.get(poiId))?.generation.sources?.sourceWarnings ?? []),
          ...(relatedPeople.sourceWarnings ?? []),
        ];
        return {
          poiId,
          ...(sourceWarnings?.length ? { sourceWarnings } : {}),
          mainImageCandidates,
          ...(mainImageCandidatesError ? { mainImageCandidatesError } : {}),
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
          if (cause instanceof Error && cause.name === "AbortError") throw cause;
          throwIfGenerationCancelled();
          throw persistenceError(cause);
        }
      },
    },
    storyContent: {
      generate: async ({ poiId, ai, onProgress }) => {
        onProgress?.("Finding the Point of Interest.");
        const pointOfInterest = await findPointOfInterest(poiId, dependencies);
        onProgress?.("Fetching the Wikipedia Source.");
        const sources = await acquireAndPersistSources(
          pointOfInterest,
          (await dependencies.repository.get(poiId))?.sources,
          onProgress,
        );
        const resolution = await generateAndPersistStoryContent(
          pointOfInterest,
          sources,
          ai,
          onProgress,
        );
        const sourceWarnings = [
          ...((await dependencies.repository.get(poiId))?.generation.sources?.sourceWarnings ?? []),
          ...(resolution.sourceWarnings ?? []),
        ];
        return { ...resolution, ...(sourceWarnings.length ? { sourceWarnings } : {}) };
      },
      delete: async ({ poiId }) => {
        try {
          await dependencies.repository.deleteStoryContent(poiId);
        } catch (cause) {
          if (cause instanceof Error && cause.name === "AbortError") throw cause;
          throwIfGenerationCancelled();
          throw persistenceError(cause);
        }
      },
    },
    relatedPeople: {
      resolve: async ({ poiId, ai, onProgress }) => {
        const startedAt = now().getTime();
        onProgress?.("Loading the saved Story and its Sources.");
        const snapshot = await dependencies.repository.get(poiId);
        if (!snapshot?.storyContent) {
          throw new StoryWorkflowError({
            code: "sources-unavailable",
            stage: "sources",
            retryable: true,
          });
        }
        if (snapshot.sources.length === 0) onProgress?.("Fetching the missing Wikipedia Source.");
        const sources =
          snapshot.sources.length > 0
            ? snapshot.sources
            : await acquireAndPersistSources(
                await findPointOfInterest(poiId, dependencies),
                undefined,
                onProgress,
              );
        const resolution = await dependencies.resolveRelatedPeople({
          relatedPeople: snapshot.storyContent.relatedPeople,
          sources,
          ai,
          onProgress,
        });
        throwIfGenerationCancelled();
        onProgress?.("Saving the updated Related People.");
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
              relatedPeopleFailures: resolution.failures,
              ...(resolution.sourceWarnings?.length
                ? { sourceWarnings: resolution.sourceWarnings }
                : {}),
            },
          );
        } catch (cause) {
          if (cause instanceof Error && cause.name === "AbortError") throw cause;
          throwIfGenerationCancelled();
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
          if (cause instanceof Error && cause.name === "AbortError") throw cause;
          throwIfGenerationCancelled();
          throw persistenceError(cause);
        }
      },
    },
  };
  return workflow;
};
