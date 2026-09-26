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
  links?: Array<{ label: string; title: string }>;
};

export type DraftMainImage = MainImageCandidate;

export type GenerationCheckpoint = {
  durationMs: number;
  completedAt: string;
  aiMode?: AiSelection["mode"];
  aiProvider?: "ollama" | "gemini";
  aiModel?: string;
  relatedPeopleFailures?: RelatedPeopleResolutionFailure[];
};

export type DraftStoryGenerationStatus = {
  sources?: GenerationCheckpoint;
  mainImageCandidates?: GenerationCheckpoint;
  storyContent?: GenerationCheckpoint;
  relatedPeople?: GenerationCheckpoint;
};

export type DraftStorySnapshot = {
  poiId: string;
  sources: Source[];
  storyContent?: StoryContent;
  mainImageCandidates: MainImageCandidate[];
  draftMainImage?: DraftMainImage;
  generation: DraftStoryGenerationStatus;
};

export type DraftStoryGenerationResult = {
  poiId: string;
  mainImageCandidates: "generated" | "failed";
  draftMainImage: "available" | "missing";
  storyContent: "generated";
  relatedPeople: "resolved" | "partial";
  relatedPeopleFailures: RelatedPeopleResolutionFailure[];
};

export type RelatedPeopleResolutionFailure = {
  name: string;
  message: string;
};

export type RelatedPeopleResolutionResult = {
  relatedPeople: StoryContent["relatedPeople"];
  failures: RelatedPeopleResolutionFailure[];
};

export type StoryWorkflowErrorCode =
  | "point-of-interest-not-found"
  | "sources-unavailable"
  | "story-content-generation-failed"
  | "main-image-candidates-generation-failed"
  | "persistence-failed";

export type StoryWorkflowErrorStage =
  | "sources"
  | "mainImageCandidates"
  | "storyContent"
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
    super(cause instanceof Error && cause.message ? `${code}: ${cause.message}` : code, { cause });
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
      onProgress?: (message: string) => void;
    }): Promise<DraftStoryGenerationResult>;
    get(input: { poiId: string }): Promise<DraftStorySnapshot | undefined>;
    reset(input: { poiId: string }): Promise<void>;
  };
  storyContent: {
    generate(input: {
      poiId: string;
      ai: AiSelection;
      onProgress?: (message: string) => void;
    }): Promise<RelatedPeopleResolutionResult>;
    delete(input: { poiId: string }): Promise<void>;
  };
  relatedPeople: {
    resolve(input: {
      poiId: string;
      ai: AiSelection;
      onProgress?: (message: string) => void;
    }): Promise<RelatedPeopleResolutionResult>;
  };
  mainImageCandidates: {
    generate(input: { poiId: string }): Promise<void>;
    delete(input: { poiId: string }): Promise<void>;
  };
};
