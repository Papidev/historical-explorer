# Entity Discovery

Status: POI-to-Person details are implemented. Person-to-POI navigation is planned in [#72](https://github.com/Papidev/historical-explorer/issues/72); Events, Artifacts, and independent ranking remain future work.

## Current behavior

Story generation selects and orders at most ten Related People significant to understanding the POI. People may be historical, mythological, or imaginary. Wikipedia links resolve identities; canonical records are reused or generated, with app-owned `personId` and supporting `sourceIds`.

Ambiguous references remain non-navigable in the editorial workflow. Story Content is preserved for retry, but any retained unresolved reference or missing Person record excludes the POI from the public catalog. Visitors can open a resolved Person in the POI drawer and return to the original Story. See [Person Architecture](person-architecture.md).

Use existing public catalog eligibility for all visitor paths. Explicit approval is optional future work, not a dependency; current records must not be described as approved.

## Responsibilities

1. **Discovery:** find candidates with evidence of a significant connection.
2. **Identity resolution:** identify and reuse the specific entity without guessing.
3. **Ranking:** order valid entities within their category.
4. **Presentation:** provide useful lists, details, and navigation.

A Wikipedia link or resolved identity does not prove the connection's significance. A Source ID identifies a document, not the supporting passage. Retain connection evidence internally without requiring a formal relationship vocabulary; the visitor list can show names, while the POI Story explains the connection.

Keep these separate:

- **Metadata:** filterable categories and architectural styles, acquired outside Story Content.
- **Connections:** evidenced POI-to-Person, Event, or Artifact associations.
- **Insights:** visitor-visible cultural explanations.

Story regeneration must not redefine filter values. Prefer structured facts over LLM inference where available, preserve identity and date precision, and keep POIs when structured data is missing. Source disagreements need contextual review. Category/style work is in #38–#39; period filtering (#40) is deferred.

## Source and tool roles

| Source/tool | Role |
| --- | --- |
| Wikipedia | Narrative context and connection evidence, including gaps in structured data. |
| Wikidata | External identity, types, dates, coordinates, and available statements. |
| Wikimedia Commons | Images and rights metadata. |
| LLM | Source-grounded extraction when deterministic data is insufficient, using Story Workflow providers. |
| Jev | Unadopted candidate for independent ordering; evaluate before integration. |

Check existing `wtf_wikipedia` plugins before implementing parsing or enrichment, as required by repository guidance.

## Ranking boundary

Rank by historical or cultural significance of the connection to this POI, not fame, mention count, or semantic similarity. Inputs are the POI, valid entities from one category, and connection evidence. Output must be a permutation of those entities: no additions, omissions, duplicates, or content changes. Discovery validates candidates before ranking.

If integrated, preserve the existing order on failure or invalid output and keep the ranker replaceable. The [Jev backlog entry](backlog.md#evaluate-jev-for-ordering-related-people) defines the API, quality, latency, cost, and failure evaluation; Jev is not an adopted dependency.

## Incremental delivery

Follow small complete slices as in [#35](https://github.com/Papidev/historical-explorer/issues/35):

- Derive Person-to-POI associations from Story references, not a second list on Person records.
- Introduce Events through source acquisition, identity, and a detail view; first distinguish concrete occurrences from broad periods.
- Introduce Artifacts similarly; first resolve overlap with visitable POIs to avoid duplicate identities.
- Add Wikidata discovery only for real, evidenced gaps in the Wikipedia path.
- Evaluate ranking separately.

A generic entity framework, relationship taxonomy, generated prose per connection, automatic “must-see” selection, cross-category ranking, graph visualization, and dedicated graph storage are outside these slices. Follow-up triggers remain in the [backlog](backlog.md).

## Agreed discovery and search filter behavior

Both paths use published POIs in the current city:

- **Person discovery (#72):** associated POIs intersect with active filters. Clearing the Person constraint preserves those filters.
- **Name search [#68](https://github.com/Papidev/historical-explorer/issues/68):** searches all published POIs, including filtered-out places. Selecting an excluded result temporarily reveals its marker and opens its detail with a filter notice. Filters stay unchanged; closing removes the exception and selecting another result replaces it.

Neither path exposes draft-only or metadata-only POIs.
