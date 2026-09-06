# Backlog

This document preserves potentially useful product and architecture observations that are not planned work.

An entry should become a GitHub Issue only when its **Revisit when** condition occurs. At that point, replace the entry with a link to the issue or remove it after the issue has captured the relevant context.

## Support Geo Places without Wikidata

**Observation**  
The current Geo Place to Point of Interest flow relies mainly on Wikidata to reconnect the source item with the newly assigned POI ID.

**Risk**  
After creating a Point of Interest from a Geo Place without Wikidata, later Story Workflow steps may still use the source identifier and fail to find the new Point of Interest.

**Revisit when**  
We want to create the first Point of Interest from a Geo Place that has no Wikidata ID.

**Possible direction**  
Concentrate Point of Interest creation from a Geo Place, POI ID allocation, external identifiers, and catalog persistence in one Point of Interest catalog Module.

## Scope local data access by city

**Observation**  
The filesystem layout is city-scoped under `data/<city>/`, but some Story and admin paths still assume Rome internally even when their callers provide a city.

**Risk**  
A future city could read or modify Rome data, especially when two cities contain the same POI ID.

**Revisit when**  
We start implementing a second city or another caller begins using the city parameter.

**Possible direction**  
Concentrate POI, Story, and generated-data paths in one city-scoped Module without introducing a storage Adapter until a second storage implementation exists.

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

## Introduce Story approval before visitor visibility

**Observation**  
Story status is not represented. Content written by the Story Workflow can be read immediately by the Visitor Experience.

**Risk**  
The application cannot distinguish a Draft Story awaiting Curator review from an approved Story.

**Revisit when**  
We introduce Curator approval or need to prevent unfinished content from appearing in the Visitor Experience.

**Possible direction**  
Represent the Draft Story to Story transition explicitly and make visitor-facing reads return only approved Stories.

## Model multiple Story Sources

### Current state

The first Story Content slice uses one locally generated Wikipedia snapshot with the conventional Source ID `wikipedia`. Its readable text and metadata sidecar live under the ignored `data/<city>/generated/wiki/` directory. Source References are validated while generating Story Content, but the Visitor Experience can read the versioned `story.json` without requiring that local snapshot.

### Current limitation

The conventional ID and local sidecar are intentionally narrow. They do not define identity, versioning, replacement, citation granularity, or persistence rules for multiple Wikipedia pages or heterogeneous providers.

### Trigger

We add a second source to one Story, need Source history across regenerations, or expose selected Sources to visitors.

### Direction

Design a city-scoped Source model only when the trigger occurs. Decide stable identity, ownership, versioning, storage location, and whether Source References address whole documents or individual claims. Migrate the current Wikipedia snapshot without requiring Story Content or the public renderer to know its physical file layout.

## Localize historical date formatting

**Observation**

Story Content stores language-neutral numeric years and the current English renderer displays historical dates with `AD` and `BC`, for example `338 AD` and `264 BC`.

**Risk**

Date labels may use the wrong vocabulary or ordering when the Visitor Experience supports another language. English may require `AD 338`, `338 CE`, or `338 AD` according to the chosen editorial convention, while Italian typically uses forms such as `338 d.C.` and `264 a.C.`.

**Revisit when**

The Visitor Experience adds language selection or localized Story Content.

**Possible direction**

Move historical date formatting behind a locale-aware formatter. Keep numeric years, precision, and granularity in Story Content, and let the selected locale determine era labels, label placement, abbreviations, and century formatting.
