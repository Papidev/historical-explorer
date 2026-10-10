# Story Workflow Module Architecture

Status: implemented.

The server-side Story Workflow hides sequencing, persistence, partial failures, and external integrations behind an artifact-oriented interface. It starts from an existing POI. The Draft Story Generation coordination module owns POI creation, Type acquisition, classification, and run-log outcomes outside Story Workflow; the Next server-action Adapter owns input parsing, progress transport, and revalidation.

## Generate and Refresh

The browser labels an empty row **Generate** and a populated row **Refresh**. Both submit the original Geo Place ID and current AI selection to the same Adapter, which invokes `src/server/draftStoryGeneration.ts`:

1. Call `pointOfInterest.generate({ geoPlaceId })` to create/replace the POI, retaining its stable ID.
2. Call `storyWorkflow.draftStory.generate({ poiId, ai })` with a Sources-acquired callback.
3. Once Sources are saved, link the discovered Wikidata identity, refresh POI Types, and classify unmapped types before image and content generation continue. Type acquisition or classification failure does not stop Story generation.

Single and batch generation use the same coordination module. One issue list supplies run-log status/errors and Curator warnings/failed steps, including classification failures. The Adapter uses those warnings to finish progress as partial and revalidates affected cities when classification changes their categories, even if a later Story step fails.

The POI Module owns Geo Place access, cleaning, ID allocation, external identifiers, and catalog persistence. Its `reset({ poiId })` removes derived catalog state while preserving the Geo Place; Refresh never invokes reset.

Within full Draft Story generation, the order is fixed:

1. Acquire and clean Sources.
2. Generate Main Image Candidates.
3. Preserve an eligible current image, or select the first licensed and attributed candidate.
4. Generate Story Content and resolve Related People.

Callers cannot reorder or skip steps. Full generation uses private implementation functions because its failure policy differs from independent artifact actions.

## Interface

```ts
type AiSelection = {
  mode: "local" | "cloud";
  model: string;
};

type Source = {
  id: string;
  kind: "wikipedia";
  title: string;
  url: string;
  content: string;
};

type DraftStorySnapshot = {
  poiId: string;
  sources: Source[];
  storyContent?: StoryContent;
  mainImageCandidates: MainImageCandidate[];
  draftMainImage?: DraftMainImage;
  generation: DraftStoryGenerationStatus;
};

type StoryWorkflow = {
  draftStory: {
    generate(input: { poiId: string; ai: AiSelection }): Promise<DraftStoryGenerationResult>;

    get(input: { poiId: string }): Promise<DraftStorySnapshot | undefined>;

    reset(input: { poiId: string }): Promise<void>;
  };

  storyContent: {
    generate(input: { poiId: string; ai: AiSelection }): Promise<RelatedPeopleResolutionResult>;

    delete(input: { poiId: string }): Promise<void>;
  };

  relatedPeople: {
    resolve(input: { poiId: string; ai: AiSelection }): Promise<RelatedPeopleResolutionResult>;
  };

  mainImageCandidates: {
    generate(input: { poiId: string }): Promise<void>;

    delete(input: { poiId: string }): Promise<void>;
  };
};
```

| Operation                                                | Behavior                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `draftStory.generate`                                    | Full generation with checkpoint persistence.                                                         |
| `draftStory.get`                                         | Domain snapshot without paths/formats; the loader may join external POI/Geo Place data.              |
| `draftStory.reset`                                       | Remove workflow Sources, content, candidates, image selection, and metadata; preserve POI/Geo Place. |
| `storyContent.generate` / `mainImageCandidates.generate` | Create or replace that artifact.                                                                     |
| `relatedPeople.resolve`                                  | Retry unresolved references from saved content, preserving resolved People.                          |
| Artifact `delete` actions                                | Curator recovery with paths/cascade rules kept inside the Module.                                    |

Generation is not idempotent: AI output and external Sources may change. The UI may label artifact actions Generate or Refresh depending on whether content exists. Editing content and selecting an image belong to separate Story Curation; explicit approval remains optional future work.

## Partial-failure behavior

Successful checkpoints remain available for independent retry; there is no whole-operation rollback.

| Failure               | Full generation outcome                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| Source acquisition    | Stop downstream generation.                                                |
| Main Image Candidates | Report failure; continue Story Content generation.                         |
| Story Content         | Keep acquired Sources and candidates.                                      |
| Related People        | Keep Story Content, preserve unresolved names, and report partial success. |

An explicitly requested artifact action preserves its previous artifact and rejects on failure. Refresh does not clear the row first; replacements are saved when ready.

Story Content and Related People have separate timing/completion checkpoints. Retrying People updates only that checkpoint and does not regenerate Story Content.

## Result and errors

```ts
type DraftStoryGenerationResult = {
  poiId: string;
  mainImageCandidates: "generated" | "failed";
  draftMainImage: "available" | "missing";
  storyContent: "generated";
  relatedPeople: "resolved" | "partial";
  relatedPeopleFailures: RelatedPeopleResolutionFailure[];
};
```

```ts
type StoryWorkflowError = {
  code:
    | "point-of-interest-not-found"
    | "sources-unavailable"
    | "story-content-generation-failed"
    | "main-image-candidates-generation-failed"
    | "persistence-failed";
  stage: "sources" | "mainImageCandidates" | "storyContent" | "persistence";
  retryable: boolean;
};
```

Results and errors use domain states without exposing paths or provider response shapes. Candidate failure is a partial full-generation result, but an independent candidate request rejects with `StoryWorkflowError`.

## Adapters and dependencies

Inputs are POI ID and the Local/Cloud AI selection where needed. Ollama and Gemini implement an internal AI seam; Wikipedia, Wikidata, and Commons remain internal HTTP integrations. Filesystem persistence is internal. Next Adapters own `FormData` parsing and `revalidatePath`.

The browser shows one overall `Generating Draft Story...` state; independent artifact actions have their own labels. Per-step server progress is a [backlog option](backlog.md#report-story-workflow-progress-to-the-browser), without moving orchestration into the browser.

## Verification

Test through the public interface: ordering, downstream stopping/continuation, checkpoint preservation, independent replacement, image preservation/fallback, and domain results/errors. Use MSW for HTTP where practical and temporary directories for persistence without exposing storage APIs.
