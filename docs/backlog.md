# Backlog migration index

GitHub Issues and the Cultural Atlas Project associated with this repository are the source of truth for bugs, improvements, and future ideas. This document preserves the former Markdown headings for existing documentation links; it is not a parallel backlog.

Reviewed and migrated on October 11, 2026. Twelve remaining observations were recorded as Backlog issues with their context and revisit conditions. Tracking an idea does not schedule implementation. Two entries are already resolved; Person-to-POI discovery was already tracked.

## Use Next.js prerendering for public Stories and the map

Tracked in GitHub issue #99: Add prerendered public Story pages and evaluate static map rendering. Consult the issue for scope, revisit conditions, milestone, and current status.

## Treat each Story directory as one aggregate

Tracked in GitHub issue #100: Evaluate unified Story artifact storage when workflow complexity warrants it. Consult the issue for scope, revisit conditions, milestone, and current status.

## Report Story Workflow progress to the browser

Already implemented: server-generated progress is polled by the browser and displayed with phase logs, final outcomes, partial failures, and log-loading errors. See merged PRs #89, #95, and #98 and the [Story Workflow architecture](story-workflow-architecture.md#adapters-and-dependencies).

## Introduce a Curator read model

Tracked in GitHub issue #101: Evaluate a Curator read model when catalog composition becomes problematic. Consult the issue for scope, revisit conditions, milestone, and current status.

## Use one generation metadata model

Already resolved: the Curator loader imports the shared `GenerationMetadata` type from the generation metadata module; generation checkpoints also use the shared Story Workflow type. No new issue is needed.

## Consider explicit Story approval

Tracked in GitHub issue #102: Evaluate explicit Story approval if an editorial workflow is adopted. Consult the issue for scope, revisit conditions, milestone, and current status.

## Model multiple Story Sources

Tracked in GitHub issue #103: Support multiple Story Sources when a concrete second-source use case exists. Consult the issue for scope, revisit conditions, milestone, and current status.

## Check POI categories against Story Content

Tracked in GitHub issue #104: Review concrete POI category and Story mismatches with a Curator. Consult the issue for scope, revisit conditions, milestone, and current status.

## Localize historical date formatting

Tracked in GitHub issue #105: Localize historical dates when language selection is introduced. Consult the issue for scope, revisit conditions, milestone, and current status.

## Show related Points of Interest for People

Already tracked in GitHub issue #72 and the Cultural Atlas Project, under POI discovery. Connected published POIs use the current city and active filters; the issue owns navigation and return-path requirements.

## Preserve evidence for entity connections

Tracked in GitHub issue #106: Preserve source evidence for significant entity connections. Consult the issue for scope, revisit conditions, milestone, and current status.

## Discover related Events

Tracked in GitHub issue #107: Discover source-supported Events connected to POIs. Consult the issue for scope, revisit conditions, milestone, and current status.

## Discover related Artifacts

Tracked in GitHub issue #108: Discover source-supported Artifacts connected to POIs. Consult the issue for scope, revisit conditions, milestone, and current status.

## Complement Wikipedia entity discovery with Wikidata

Tracked in GitHub issue #109: Complement Wikipedia entity discovery with evidenced Wikidata connections. Consult the issue for scope, revisit conditions, milestone, and current status.

## Evaluate Jev for ordering related People

Tracked in GitHub issue #110: Evaluate Jev for ordering already-validated Related People. Consult the issue for scope, revisit conditions, milestone, and current status.
