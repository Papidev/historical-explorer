# Story Workflow Module Architecture

Status: implemented.

## Goal

Deepen the server-side **Story Workflow Module** so callers use a small **Interface** while ordering, partial-failure behavior, persistence, and external integrations remain in its **Implementation**.

The browser keeps one Generate action. Its Next server-action **Adapter** may first use a separate **Point of Interest Module** to create a **Point of Interest** from a **Geo Place**, then invoke the Story Workflow with the resulting **POI ID**.

The Point of Interest Module has its own **Interface** and **Implementation**. It hides Geo Place access, source-data cleaning, POI ID allocation, external-identifier preservation, and POI catalog persistence.

```ts
type PointOfInterestModule = {
  generate(input: {
    geoPlaceId: string;
  }): Promise<{ poiId: string }>;

  reset(input: {
    poiId: string;
  }): Promise<void>;
};
```

`generate({ geoPlaceId })` creates the Point of Interest and returns its POI ID. `reset({ poiId })` removes the derived Point of Interest state from the POI catalog while preserving the Geo Place. The name Reset reflects a transition back to the source-only state rather than permanent deletion of the place.

Creating a Point of Interest from a Geo Place does not belong to the Story Workflow. The Story Workflow starts from an existing Point of Interest and does not know how it was created.

```text
Geo Place -> Point of Interest Module -> Point of Interest -> Story Workflow Module -> Draft Story
```

The Next server-action Adapter behind the single Generate action composes the two Modules:

```ts
const { poiId } = await pointOfInterest.generate({ geoPlaceId });
return storyWorkflow.draftStory.generate({ poiId, ai });
```

## Interface

The agreed **Interface** groups operations by the domain artifact they affect.

```ts
type AiSelection = {
  mode: "local" | "cloud";
  model: string;
};

type DraftStorySnapshot = {
  poiId: string;
  sources: Source[];
  storyProse?: string;
  mainImageCandidates: MainImageCandidate[];
  draftMainImage?: DraftMainImage;
  generation: DraftStoryGenerationStatus;
};

type StoryWorkflow = {
  draftStory: {
    generate(input: {
      poiId: string;
      ai: AiSelection;
    }): Promise<DraftStoryGenerationResult>;

    get(input: {
      poiId: string;
    }): Promise<DraftStorySnapshot | undefined>;

    reset(input: {
      poiId: string;
    }): Promise<void>;
  };

  storyProse: {
    generate(input: {
      poiId: string;
      ai: AiSelection;
    }): Promise<void>;

    delete(input: {
      poiId: string;
    }): Promise<void>;
  };

  mainImageCandidates: {
    generate(input: {
      poiId: string;
    }): Promise<void>;

    delete(input: {
      poiId: string;
    }): Promise<void>;
  };
};
```

`storyProse.generate` and `mainImageCandidates.generate` belong to **Draft Story Generation**. Each has create-or-replace semantics: it creates a missing artifact or generates a replacement for the current one. These operations are not idempotent because AI output and external Sources may change between calls.

The Curator UI may label the same operation Generate when its artifact is missing and Refresh when one already exists.

The two deletion operations preserve the current Curator recovery actions while keeping artifact paths and cascade rules inside the Story Workflow Module.

`draftStory.reset` removes all Sources, Story Prose, Main Image Candidates, Draft Main Image state, and generation metadata owned by the Story Workflow. It does not remove the Point of Interest or its Geo Place.

Selecting a **Draft Main Image**, editing a **Draft Story**, and approving it as a **Story** belong to **Story Curation** and cross a separate **Seam**.

`draftStory.get` returns domain data for the Curator UI without exposing artifact paths or file formats. The admin loader may combine this snapshot with Geo Place and Point of Interest data owned outside the Story Workflow.

`draftStory.generate` orchestrates full generation through private Implementation functions rather than by calling the public artifact-generation operations. Full generation has different partial-failure behavior from an explicitly requested artifact generation.

## Full generation order

`draftStory.generate` owns this order:

1. Acquire and clean **Sources**.
2. Generate **Main Image Candidates**.
3. Preserve the current **Draft Main Image** when it remains eligible; otherwise select the first candidate with license and attribution information.
4. Generate **Story Prose**.

The caller cannot choose, reorder, or skip these steps.

## Partial-failure behavior

Generation uses checkpoint semantics rather than rollback:

- Source failure stops full generation.
- Main Image Candidate failure is reported, but Story Prose generation continues.
- Story Prose failure preserves already generated Sources and Main Image Candidates.
- An explicitly requested artifact generation failure preserves the previous artifact and rejects that operation.

Successfully persisted artifacts remain available for independent retry.

## Result

Full generation returns a compact domain result:

```ts
type DraftStoryGenerationResult = {
  poiId: string;
  mainImageCandidates: "generated" | "failed";
  draftMainImage: "available" | "missing";
  storyProse: "generated";
};
```

The result communicates full or partial success without exposing file paths, provider responses, or other Implementation details.

## Errors

```ts
type StoryWorkflowError = {
  code:
    | "point-of-interest-not-found"
    | "sources-unavailable"
    | "story-prose-generation-failed"
    | "main-image-candidates-generation-failed"
    | "persistence-failed";
  stage: "sources" | "mainImageCandidates" | "storyProse" | "persistence";
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

## Full Reset coordination

The browser retains one Reset action. Its server-action Adapter coordinates two responsibilities:

1. Call `storyWorkflow.draftStory.reset({ poiId })` to remove every Story Workflow artifact.
2. Call `pointOfInterest.reset({ poiId })` to remove the derived Point of Interest state from the POI catalog.

The Geo Place remains available so the Point of Interest and its Draft Story can be generated again. Keeping POI removal outside the Story Workflow prevents the Module from acquiring responsibility for the POI catalog.

## Testing surface

Tests cross the same Interface as production callers and verify observable outcomes:

- fixed generation order;
- Source failure stopping downstream work;
- Story Prose continuing after candidate failure;
- preservation of successful checkpoints;
- independent artifact generation with create-or-replace semantics;
- Draft Main Image preservation and automatic fallback selection;
- stable domain results and errors.

HTTP behavior should use MSW where practical. Filesystem behavior should use isolated temporary data rather than exposing storage operations through the public Interface.
