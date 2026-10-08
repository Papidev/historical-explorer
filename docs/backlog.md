# Backlog

This document preserves potentially useful product and architecture observations that are not planned work.

An entry should become a GitHub Issue only when its **Revisit when** condition occurs. At that point, replace the entry with a link to the issue or remove it after the issue has captured the relevant context.

## Support Geo Places without Wikidata

**Observation**  
The current Geo Place to POI flow relies mainly on Wikidata to reconnect the source item with the newly assigned POI ID.

**Risk**  
After creating a POI from a Geo Place without Wikidata, later Story Workflow steps may still use the source identifier and fail to find the new POI.

**Revisit when**  
We want to create the first POI from a Geo Place that has no Wikidata ID.

**Possible direction**  
Concentrate POI creation from a Geo Place, POI ID allocation, external identifiers, and catalog persistence in one POI catalog Module.

## Treat each Story directory as one aggregate

**Observation**  
Each Story directory contains `story.json` and `images.json`, but separate Modules currently discover and manage the files.

**Risk**  
Callers can observe or create partial Story directories, and each caller must understand how the two files relate.

**Revisit when**  
A Story gains another artifact, partial directories cause real workflow problems, or Story reset and validation become more complex.

**Possible direction**  
Use one Story storage Module that reads, writes, lists, validates, and removes the whole per-POI aggregate while keeping the files physically separate.

## Report Story Workflow progress to the browser

**Observation**
Once Draft Story Generation runs behind one server operation, the browser can show that the overall workflow is running but cannot distinguish which step is in progress, completed, or failed.

**Risk**
Long-running generation may appear stalled, and a Curator may not understand which artifact needs an independent retry after a partial failure.

**Revisit when**
Draft Story Generation latency or partial failures make the single overall progress state insufficient for Curators.

**Possible direction**
Let the Story Workflow Module emit progress events for Source acquisition, Main Image Candidate generation, and Story Content generation. A server Adapter could deliver those events to the browser so it can show in-progress, completed, and failed steps without moving orchestration back into the client.

## Introduce a Curator read model

**Observation**
`loadPoiLists` builds the Curator table by joining Geo Places, Points of Interest, Sources, Story Content, Main Image Candidates, and generation metadata in several passes.

**Risk**
As the Story Workflow gains states or artifacts, the loader can become a second orchestration layer whose row-merging rules are difficult to understand and test.

**Revisit when**
The Curator table gains another workflow state, artifact, filter, or city-specific view, or its merge logic starts causing defects.

**Possible direction**
Introduce one Curator-facing read model assembled server-side from the POI and Story Workflow Modules. Keep it a query projection rather than adding write behavior or moving workflow decisions into the UI.

## Use one generation metadata model

**Observation**
The Curator loader declares its own `GenerationStep` and `GenerationMetadata` shapes while the canonical persistence types live in the generation metadata Module and the Story Workflow snapshot.

**Risk**
A new checkpoint field or generation step can be added to persistence without being reflected in the Curator projection, causing silent drift between stored and displayed metadata.

**Revisit when**
We add or rename a generation step, display more checkpoint information, or otherwise modify generation metadata.

**Possible direction**
Make the Curator projection consume the canonical generation metadata type or, preferably, the generation status already exposed by the relevant domain Module. Avoid exposing filesystem paths or storage-specific JSON shapes.

## Consider explicit Story approval

**Observation**  
Story status is not represented. Content written by the Story Workflow can be read immediately by the Visitor Experience.

**Risk**  
If we later choose to require explicit approval, the application cannot distinguish content awaiting Curator review from approved content. This is not a current publication requirement.

**Revisit when**  
We explicitly decide to add a Curator approval workflow. This is a possible future evolution, not planned work or a prerequisite for current publication or new discovery paths.

**Possible direction**  
If adopted, represent the Draft Story to Story transition explicitly and make visitor-facing reads return only approved Stories. Until then, retain the current public catalog eligibility rules.

## Model multiple Story Sources

### Current state

The first Story Content slice uses one locally generated Wikipedia snapshot with the conventional Source ID `wikipedia`. Its readable text and metadata sidecar live under the ignored `data/<city>/generated/wikipedia/` directory. Source References are validated while generating Story Content, but the Visitor Experience can read the versioned `story.json` without requiring that local snapshot.

### Current limitation

The conventional ID and local sidecar are intentionally narrow. They do not define identity, versioning, replacement, citation granularity, or persistence rules for multiple Wikipedia pages or heterogeneous providers.

### Trigger

We add a second source to one Story, need Source history across regenerations, or expose selected Sources to visitors.

### Direction

Design a city-scoped Source model only when the trigger occurs. Decide stable identity, ownership, versioning, storage location, and whether Source References address whole documents or individual claims. Migrate the current Wikipedia snapshot without requiring Story Content or the public renderer to know its physical file layout.

## Check POI categories against Story Content

**Observation**

Wikidata can classify a POI in several ways, while its Story may describe a different historical or present-day use. A difference is not necessarily a contradiction.

**Risk**

A visitor filter such as "Churches" could include a POI whose Story does not explain why it belongs there.

**Revisit when**

The first Wikidata-backed category filter is implemented in #38 and its mapped POIs can be reviewed alongside their Stories.

**Possible direction**

Review concrete mismatches with a Curator before adding any automated warning. Keep category mapping separate from Story Content and account for changes of use over time.

## Localize historical date formatting

**Observation**

Story Content stores language-neutral numeric years and the current English renderer displays historical dates with `AD` and `BC`, for example `338 AD` and `264 BC`.

**Risk**

Date labels may use the wrong vocabulary or ordering when the Visitor Experience supports another language. English may require `AD 338`, `338 CE`, or `338 AD` according to the chosen editorial convention, while Italian typically uses forms such as `338 d.C.` and `264 a.C.`.

**Revisit when**

The Visitor Experience adds language selection or localized Story Content.

**Possible direction**

Move historical date formatting behind a locale-aware formatter. Keep numeric years, precision, and granularity in Story Content, and let the selected locale determine era labels, label placement, abbreviations, and century formatting.

## Show related Points of Interest for People

**Observation**

A global Person may be referenced by multiple Stories, but the first visitor flow only opens that Person from the current Story and returns to the same POI.

**Risk**

Visitors cannot use a Person as a path for discovering the other places connected to them.

**Revisit when**

We introduce standalone Person navigation or prioritize discovering Points of Interest through people.

**Possible direction**

Derive the related Points of Interest from Story references to `personId` instead of storing a second list on the Person. Present only visitor-facing Stories available in the public catalog under the existing publication rules.

Verify the complete POI A → Person → POI B path, including returning to the original place. Approval is not currently implemented and is not required for this path; use the existing public catalog as the visibility boundary. See [Entity discovery](entity-discovery.md).

Include a way to see the associated POIs on the map when selecting a Person, and to clear that selection. The association is enough for discovery; opening a POI should explain the connection through its Story. Agree on city scope and interaction with category, style, and period filters when this slice is prioritized.

## Preserve evidence for entity connections

**Observation**

Related People retain Source IDs, while linked Wikipedia articles resolve identities. Neither alone records the specific evidence that makes a connection significant.

**Risk**

Identity resolution can be mistaken for connection validation, and a future ranker may order entities without enough context about their relationship to the POI.

**Revisit when**

We evaluate independent ranking, add Wikidata-backed entity discovery, or introduce the first Event or Artifact.

**Possible direction**

Retain the supporting passage or structured statement for each connection internally. Keep identity resolution separate from connection validation and avoid requiring a formal relationship taxonomy. Coordinate with the multiple Story Sources entry if new sources are introduced.

## Discover related Events

**Observation**

Story history insights describe occurrences, but Events do not yet have reusable identities or visitor detail views.

**Risk**

Visitors cannot explore a historical occurrence across places, and broad periods could be conflated with specific events.

**Revisit when**

We prioritize the first Event discovery path and select real POIs with source-supported occurrences.

**Possible direction**

Agree on the Event boundary using catalog examples, then deliver one complete discovery, identity resolution, and drawer detail slice. Keep unsupported or ambiguous identities non-navigable. Evaluate category tabs once real content makes the presentation useful; a general graph framework is not a prerequisite.

## Discover related Artifacts

**Observation**

Story art insights can mention works and objects, but Artifacts do not yet have reusable identities or visitor detail views.

**Risk**

Visitors cannot explore an artwork or object independently. A monument that is also a POI could acquire duplicate identities.

**Revisit when**

We prioritize the first Artifact discovery path and select real works or objects with source-supported POI connections.

**Possible direction**

Agree on the Artifact boundary and its overlap with POIs before implementing a complete source-to-detail-view slice. Start with concrete works or objects and preserve their connection evidence without introducing a general ontology.

## Complement Wikipedia entity discovery with Wikidata

**Observation**

People are currently selected during Story generation from Wikipedia. Wikidata is used for canonical Person identity, but not as a complementary discovery path for related entities.

**Risk**

Significant structured connections may be missed, while indiscriminately importing statements could produce irrelevant or duplicate candidates.

**Revisit when**

A review of actual POIs identifies significant connections missing from the Wikipedia-first path that Wikidata can support.

**Possible direction**

Add the smallest discovery path for those examples, retaining statement evidence and merging candidates through resolved identities. Preserve Wikipedia discovery when structured data is absent. Do not equate the existence of a statement with editorial significance.

Begin with a source comparison for actual catalog POIs: record which useful facts and connections come from Wikidata, Wikipedia, or both, and where identity or historical context differs. Use those examples to choose the first additional path rather than building a broad property importer. Category, style, and period acquisition already belong to issues #38–#40; creator connections remain a future concrete case.

## Evaluate Jev for ordering related People

**Observation**

Story generation currently selects and orders at most ten People in one operation. Jev was proposed as a separate future ranking candidate; it has not been evaluated or integrated.

**Risk**

A ranker could reward fame or semantic similarity rather than the significance of the connection, or silently filter entities that discovery already accepted.

**Revisit when**

We prioritize independent ordering and have connection evidence plus a Curator-reviewed expected order for People on 3–5 real POIs.

**Possible direction**

Verify Jev's concrete API and evaluate it against the current Story order using the same valid People. Assess quality, latency, cost, and failures before deciding on integration. Require exactly the same entities in the output, ordered within one category. Jev must not discover, validate, filter, add, or rewrite entities. Preserve the existing order on failure or invalid output and keep ranking replaceable. Events and Artifacts can be evaluated later when their discovery paths exist; cross-category ranking remains outside scope.
