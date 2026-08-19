# Backlog

This document preserves potentially useful product and architecture observations that are not planned work.

An entry should become a GitHub Issue only when its **Revisit when** condition occurs. At that point, replace the entry with a link to the issue or remove it after the issue has captured the relevant context.

## Support Raw POIs without Wikidata

**Observation**  
The current Raw POI to Point of Interest flow relies mainly on Wikidata to reconnect the source item with the newly assigned POI ID.

**Risk**  
After adopting a Raw POI without Wikidata, later Story Workflow steps may still use the source identifier and fail to find the new Point of Interest.

**Revisit when**  
We want to adopt the first Raw POI that has no Wikidata ID.

**Possible direction**  
Concentrate Raw POI adoption, POI ID allocation, external identifiers, and catalog persistence in one Point of Interest catalog Module.

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
Each Story directory contains `story.md` and `images.json`, but separate Modules currently discover and manage the two files.

**Risk**  
Callers can observe or create partial Story directories, and each caller must understand how the two files relate.

**Revisit when**  
A Story gains another artifact, partial directories cause real workflow problems, or Story reset and validation become more complex.

**Possible direction**  
Use one Story storage Module that reads, writes, lists, validates, and removes the whole per-POI aggregate while keeping the files physically separate.

## Run the Story Workflow server-side

**Observation**  
The admin browser currently knows and executes the sequence Point of Interest, Wikipedia Text, Story, and Main Image Candidates through separate server actions.

**Risk**  
Workflow ordering and identifier transitions leak into the browser, interrupted runs leave partial state, and another caller would need to reproduce the same orchestration.

**Revisit when**  
The Story Workflow gains another step, needs resume behavior, or must be invoked outside the admin browser.

**Possible direction**  
Move ordering, identifier resolution, partial-failure behavior, and cascade deletion into a deep Story Workflow Module while retaining independent retry operations.

## Introduce Story approval before visitor visibility

**Observation**  
Story status is not represented. Content written by the Story Workflow can be read immediately by the Visitor Experience.

**Risk**  
The application cannot distinguish a Draft Story awaiting Curator review from an approved Story.

**Revisit when**  
We introduce Curator approval or need to prevent unfinished content from appearing in the Visitor Experience.

**Possible direction**  
Represent the Draft Story to Story transition explicitly and make visitor-facing reads return only approved Stories.
