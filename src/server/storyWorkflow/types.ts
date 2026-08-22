import type { MainImageCandidate } from "@/server/wikiPipeline/types";

export type AiSelection = {
  mode: "local" | "cloud";
  model: string;
};

export type Source = {
  kind: "wikipedia";
  content: string;
};

export type DraftMainImage = MainImageCandidate;

export type GenerationCheckpoint = {
  durationMs: number;
  completedAt: string;
  aiMode?: AiSelection["mode"];
  aiProvider?: "ollama" | "gemini";
  aiModel?: string;
};

export type DraftStoryGenerationStatus = {
  sources?: GenerationCheckpoint;
  mainImageCandidates?: GenerationCheckpoint;
  storyProse?: GenerationCheckpoint;
};

export type DraftStorySnapshot = {
  poiId: string;
  sources: Source[];
  storyProse?: string;
  mainImageCandidates: MainImageCandidate[];
  draftMainImage?: DraftMainImage;
  generation: DraftStoryGenerationStatus;
};

export type DraftStoryGenerationResult = {
  poiId: string;
  mainImageCandidates: "generated" | "failed";
  draftMainImage: "available" | "missing";
  storyProse: "generated";
};

export type StoryWorkflowErrorCode =
  | "point-of-interest-not-found"
  | "sources-unavailable"
  | "story-prose-generation-failed"
  | "main-image-candidates-generation-failed"
  | "persistence-failed";

export type StoryWorkflowErrorStage =
  | "sources"
  | "mainImageCandidates"
  | "storyProse"
  | "persistence";

export class StoryWorkflowError extends Error {
  readonly code: StoryWorkflowErrorCode;
  readonly stage: StoryWorkflowErrorStage;
  readonly retryable: boolean;

  constructor({
    code,
    stage,
    retryable,
    cause,
  }: {
    code: StoryWorkflowErrorCode;
    stage: StoryWorkflowErrorStage;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(code, { cause });
    this.name = "StoryWorkflowError";
    this.code = code;
    this.stage = stage;
    this.retryable = retryable;
  }
}

export type StoryWorkflow = {
  draftStory: {
    generate(input: {
      poiId: string;
      ai: AiSelection;
    }): Promise<DraftStoryGenerationResult>;
    get(input: { poiId: string }): Promise<DraftStorySnapshot | undefined>;
    reset(input: { poiId: string }): Promise<void>;
  };
  storyProse: {
    generate(input: { poiId: string; ai: AiSelection }): Promise<void>;
    delete(input: { poiId: string }): Promise<void>;
  };
  mainImageCandidates: {
    generate(input: { poiId: string }): Promise<void>;
    delete(input: { poiId: string }): Promise<void>;
  };
};
