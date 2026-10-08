# Entity Discovery

Status: product direction. Only the current People path described below is implemented; the broader discovery and ranking flow is future work.

## Current behavior

Story Content generation selects at most ten Related People, already ordered by significance to understanding the POI. Selection and ordering currently happen in the same AI operation; there is no separate ranking stage.

The Person resolver uses links from the POI's Wikipedia source to resolve identities, reuses existing People, and generates missing Person records. Ambiguous references remain non-navigable. Resolved references carry an app-owned `personId` and supporting `sourceIds`. People can include historical, mythological, or imaginary figures under the current Story generation rules.

Visitors can open a resolved Person in the existing POI drawer and return to the original Story. Person-to-other-POI navigation, Events, Artifacts, and Jev ranking are not implemented. See [Person Architecture](person-architecture.md) for the detailed current behavior.

Story and Person approval are not currently enforced. Explicit Curator approval is a possible future evolution, not a current product requirement or a prerequisite for entity navigation. Use the existing public catalog eligibility rules for visitor visibility. See the [product vision](product/vision.md) and [backlog](backlog.md#consider-explicit-story-approval).

## Future responsibilities

Keep these responsibilities distinguishable without introducing a generic entity framework before concrete slices need one:

1. **Discovery:** find candidates with evidence of a significant connection to the POI.
2. **Identity resolution:** identify the specific Person, Event, or Artifact, reuse an existing record where possible, and preserve ambiguity rather than guessing.
3. **Ranking:** order the already valid entities within their category.
4. **Presentation:** expose useful lists, detail views, and navigation without overwhelming the visitor.

Finding a Wikipedia link can help identify a candidate; it does not by itself demonstrate a culturally significant connection. Likewise, resolving an identity does not validate the connection. A reference to a source document identifies where support may be found, but does not by itself capture the supporting passage or structured statement.

The initial connection can remain simple: POI to Person, Event, or Artifact. A formal relationship vocabulary such as `designed`, `visited`, or `commissioned` is not required. This does not remove the need to retain source evidence internally, even when the visitor list shows only entity names.

Selecting a Person should eventually expose associated POIs on the map as well as provide a path into their details. The discovery action needs the association, while the POI's Story supplies the meaning of that association. A visitor should not have to select a relationship type to find places connected to a Person.

## Metadata, connections, and insights

Keep three purposes explicit:

- **Filterable POI metadata:** categories, architectural styles, and historical periods. Acquire supported structured facts and map them to small app-owned values outside Story Content; preserve original identities and date precision.
- **Entity connections:** supported associations between a POI and a Person, Event, or Artifact. Identity and connection evidence enable navigation independently of generated descriptions.
- **Visitor insights:** concise source-grounded Story Content explaining what the place is, why it matters, and what is worth noticing.

These purposes do not require converting categories, styles, and periods into generic graph nodes. Their first filter slices are already tracked in [#38](https://github.com/Papidev/historical-explorer/issues/38), [#39](https://github.com/Papidev/historical-explorer/issues/39), and [#40](https://github.com/Papidev/historical-explorer/issues/40). Neither regenerating a Story nor changing its wording should silently redefine a structured filter value.

Prefer direct acquisition of available structured facts over asking an LLM to infer them from prose. Wikipedia extraction can still provide supported connections absent from Wikidata. Missing structured data should preserve the POI; disagreements between sources need contextual review rather than an automatic universal precedence rule.

## Source and tool roles

| Source or tool    | Role                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wikipedia         | Narrative context and evidence for connections, including connections absent from structured data.                                                |
| Wikidata          | External identities, types, dates, coordinates, and structured statements where available. It complements Wikipedia.                              |
| Wikimedia Commons | Images with source, license, and attribution metadata.                                                                                            |
| LLM               | Source-grounded structured extraction where deterministic source data is insufficient. Current providers remain configured by the Story Workflow. |
| Jev               | Candidate for ordering valid entities in a future ranking experiment. No discovery, validation, filtering, or entity generation.                  |

Jev is not an adopted dependency. Its concrete API, availability, and suitability must be verified during evaluation; this document does not establish a package or integration contract. No Jive orchestration layer is needed for this product direction.

Before implementing Wikipedia parsing or enrichment, check the existing `wtf_wikipedia` plugins as required by the repository guidance.

## Ranking boundary

Ranking receives a POI, valid entities from one category, and evidence of their connections. Its result must be a permutation of the input entities: same identities and content, no omissions, additions, or duplicates.

The criterion is the historical or cultural significance of the connection to this place, rather than name recognition, mention frequency, or general semantic similarity. Discovery must exclude unsupported candidates before ranking; ranking does not make them valid.

Start evaluation with People already available in the catalog and 3–5 real POIs. Compare the output with a Curator-reviewed expected order and the current Story order. Review quality, latency, cost, and failure behavior before adopting Jev. If integrated, preserve the existing order when ranking fails or returns an invalid permutation, and keep the ranker replaceable without rewriting discovery.

## Incremental delivery and open boundaries

Extend the existing POI-to-Person path through small complete slices, consistent with [issue #35](https://github.com/Papidev/historical-explorer/issues/35):

- Derive other POIs for a Person from existing Story references, rather than storing a second list on the Person.
- Introduce Events through a source-to-detail-view slice. First agree on concrete occurrences versus broad historical periods.
- Introduce Artifacts through a source-to-detail-view slice. First agree on how an object that is also a visitable POI is represented without duplicating its identity.
- Add Wikidata-backed discovery only where real examples demonstrate gaps in the Wikipedia-first path.
- Evaluate ranking separately before integrating it.

For reverse navigation, expose only POIs and People available in the public catalog under the existing publication rules. An explicit approval gate is not a prerequisite; do not describe current records as approved.

Precise relationship classification, generated prose for every connection, automatic "must-see" selections, cross-category ranking, a graph visualization, and dedicated graph storage remain outside these initial slices. Follow-up triggers are recorded in the [backlog](backlog.md).
