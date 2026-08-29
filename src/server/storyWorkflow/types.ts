import type { MainImageCandidate } from "@/server/wikiPipeline/types";
import type { StoryContent } from "./storyContent";

export type AiSelection = {
  mode: "local" | "cloud";
  model: string;
};

export type Source = {
  id: string;
  kind: "wikipedia";
  title: string;
  url: string;
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
  storyContent?: GenerationCheckpoint;
  storyProse?: GenerationCheckpoint;
};

export type DraftStorySnapshot = {
  poiId: string;
  sources: Source[];
  storyContent?: StoryContent;
  storyProse?: string;
  mainImageCandidates: MainImageCandidate[];
  draftMainImage?: DraftMainImage;
  generation: DraftStoryGenerationStatus;
};

export type DraftStoryGenerationResult = {
  poiId: string;
  mainImageCandidates: "generated" | "failed";
  draftMainImage: "available" | "missing";
  storyContent: "generated";
};

export type StoryWorkflowErrorCode =
  | "point-of-interest-not-found"
  | "sources-unavailable"
  | "story-content-generation-failed"
  | "story-prose-generation-failed"
  | "main-image-candidates-generation-failed"
  | "persistence-failed";

export type StoryWorkflowErrorStage =
  | "sources"
  | "mainImageCandidates"
  | "storyContent"
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
    generate(input: { poiId: string; ai: AiSelection }): Promise<DraftStoryGenerationResult>;
    get(input: { poiId: string }): Promise<DraftStorySnapshot | undefined>;
    reset(input: { poiId: string }): Promise<void>;
  };
  storyProse: {
    generate(input: { poiId: string; ai: AiSelection }): Promise<void>;
    delete(input: { poiId: string }): Promise<void>;
  };
  storyContent: {
    generate(input: { poiId: string; ai: AiSelection }): Promise<void>;
    delete(input: { poiId: string }): Promise<void>;
  };
  mainImageCandidates: {
    generate(input: { poiId: string }): Promise<void>;
    delete(input: { poiId: string }): Promise<void>;
  };
};
