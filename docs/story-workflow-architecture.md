# Story Workflow Module Architecture

Status: implemented.

## Goal

Deepen the server-side **Story Workflow Module** so callers use a small **Interface** while ordering, partial-failure behavior, persistence, and external integrations remain in its **Implementation**.

The browser exposes the same full-pipeline action as Generate for an empty row and Refresh for an existing row. Its Next server-action **Adapter** creates or replaces a **POI** from a **Geo Place**, refreshes its **POI Types**, then invokes the Story Workflow with the resulting **POI ID**. POI Type acquisition belongs to the Adapter, outside **Draft Story Generation**.

The POI Module has its own **Interface** and **Implementation**. It hides Geo Place access, source-data cleaning, POI ID allocation, external-identifier preservation, and POI catalog persistence.

```ts
type PointOfInterestModule = {
  generate(input: { geoPlaceId: string }): Promise<{ poiId: string }>;

  reset(input: { poiId: string }): Promise<void>;
};
```

`generate({ geoPlaceId })` creates or replaces the POI and returns its stable POI ID. `reset({ poiId })` is a lower-level cleanup operation that removes the derived POI state from the POI catalog while preserving the Geo Place; it is not exposed as the row-level refresh action.

Creating a POI from a Geo Place does not belong to the Story Workflow. The Story Workflow starts from an existing POI and does not know how it was created.

```text
Geo Place -> POI Module -> POI -> POI Types
                            -> Story Workflow Module -> Draft Story
```

The Next server-action Adapter behind the Generate/Refresh action composes the two Modules:

```ts
const { poiId } = await pointOfInterest.generate({ geoPlaceId });
try {
  await poiTypes.refresh(poiId);
} catch (error) {
  console.warn(error);
}
return storyWorkflow.draftStory.generate({ poiId, ai });
```

## Interface

The agreed **Interface** groups operations by the domain artifact they affect.

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

`draftStory.generate`, `storyContent.generate`, and `mainImageCandidates.generate` have create-or-replace semantics: each creates missing artifacts or generates replacements for the current ones. They are not idempotent because AI output and external Sources may change between calls. The Curator UI labels full generation as Generate when the row is empty and Refresh when it already contains generated artifacts. Refresh runs the complete pipeline without resetting the row first, so a failed refresh does not begin by deleting the current artifacts. `relatedPeople.resolve` is narrower: it retries unresolved People against the saved Story Content and preserves already resolved People without regenerating the Story.

The Curator UI may label the same operation Generate when its artifact is missing and Refresh when one already exists.

The two deletion operations preserve the current Curator recovery actions while keeping artifact paths and cascade rules inside the Story Workflow Module.

`draftStory.reset` removes all Sources, Story Content, Main Image Candidates, Draft Main Image state, and generation metadata owned by the Story Workflow. It does not remove the POI or its Geo Place.

Selecting a **Draft Main Image**, editing a **Draft Story**, and approving it as a **Story** belong to **Story Curation** and cross a separate **Seam**.

`draftStory.get` returns domain data for the Curator UI without exposing artifact paths or file formats. The admin loader may combine this snapshot with Geo Place and POI data owned outside the Story Workflow.

`draftStory.generate` orchestrates full generation through private Implementation functions rather than by calling the public artifact-generation operations. Full generation has different partial-failure behavior from an explicitly requested artifact generation.

## Full generation order

`draftStory.generate` owns this order:

1. Acquire and clean **Sources**.
2. Generate **Main Image Candidates**.
3. Preserve the current **Draft Main Image** when it remains eligible; otherwise select the first candidate with license and attribution information.
4. Generate **Story Content**.

The caller cannot choose, reorder, or skip these steps.

## Partial-failure behavior

Generation uses checkpoint semantics rather than rollback:

- Source failure stops full generation.
- Main Image Candidate failure is reported, but Story Content generation continues.
- Story Content failure preserves already generated Sources and Main Image Candidates.
- Related People failure preserves Story Content, leaves failed names unresolved, and reports partial success.
- A Related People retry processes unresolved references without regenerating Story Content.
- An explicitly requested artifact generation failure preserves the previous artifact and rejects that operation.

Successfully persisted artifacts remain available for independent retry.

Story Content generation and Related People resolution have separate generation checkpoints. The Curator UI can therefore show the duration and completion time of each phase, and a Related People retry updates only the Related People checkpoint.

## Result

Full generation returns a compact domain result:

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

The result communicates full or partial success without exposing file paths, provider responses, or other Implementation details.

## Errors

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

External HTTP errors, filesystem errors, and AI-provider response shapes remain behind the Module's **Seam**.

During full generation, Main Image Candidate failure appears in the partial result. During an explicitly requested `mainImageCandidates.generate`, the same failure rejects the operation with a `StoryWorkflowError`.

## Adapters and dependencies

The public Interface receives domain inputs only: a POI ID and, where needed, the Local or Cloud AI selection and model.

- Ollama and Gemini satisfy an internal AI **Seam** through separate **Adapters**.
- Wikipedia, Wikidata, and Wikimedia Commons remain internal HTTP integrations and can be tested with MSW.
- Filesystem persistence remains internal and can be tested against a temporary data directory.
- `FormData` parsing and `revalidatePath` remain in Next server-action Adapters.

The browser transport therefore follows this shape:

```text
Browser form -> FormData -> Next server-action Adapter -> { poiId, ai } -> Story Workflow
```

## Browser progress

The initial implementation exposes one overall `Generating Draft Story...` state for full generation. Independent artifact-generation actions retain their specific progress labels.

Per-step server events are a possible future improvement recorded in `docs/backlog.md`. They must not move orchestration back into the browser.

## Full Refresh coordination

The browser exposes Refresh for a populated row. It submits the original Geo Place ID and current AI selection to the same server-action Adapter used by Generate, which coordinates two responsibilities:

1. Call `pointOfInterest.generate({ geoPlaceId })` to create or replace the app-ready POI while retaining its stable POI ID.
2. Refresh POI Types independently; a failure does not stop Story generation.
3. Call `storyWorkflow.draftStory.generate({ poiId, ai })` to reacquire Sources, regenerate Main Image Candidates, regenerate Story Content, and resolve Related People.

Refresh never invokes either reset operation. Existing artifacts are replaced only when their newly generated replacements are ready, following the workflow's checkpoint and partial-failure rules.

## Testing surface

Tests cross the same Interface as production callers and verify observable outcomes:

- fixed generation order;
- Source failure stopping downstream work;
- Story Content continuing after candidate failure;
- preservation of successful checkpoints;
- independent artifact generation with create-or-replace semantics;
- Draft Main Image preservation and automatic fallback selection;
- stable domain results and errors.

HTTP behavior should use MSW where practical. Filesystem behavior should use isolated temporary data rather than exposing storage operations through the public Interface.
