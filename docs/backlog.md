# Backlog

These are observations, not planned work. Promote an entry to a GitHub Issue only when its **Revisit when** condition occurs; then replace it with an issue link or remove it once the context is captured.

## Use Next.js prerendering for public Stories and the map

**Problem:** Stories currently load through a browser fetch after opening the map drawer and have no dedicated page or per-Story metadata. The Rome page reads `searchParams` on the server, making it dynamically rendered even though the production catalog changes only at deployment. POI selection is now synchronized with the URL; see [Visitor map](../README.md#visitor-map).

**Revisit when:** Public Story discoverability/sharing or initial-load performance is prioritized.

**Direction:** Add prerendered Story pages with dedicated metadata and social previews while retaining the map drawer and sharing presentation components. Evaluate a static map page with query reading confined to a client component under Suspense. Avoid adding cache infrastructure without a concrete need.

## Evaluate public image optimization

**Problem:** Homepage `next/image` instances use `unoptimized`; map previews and details use native images. Wikimedia thumbnails may already be suitable, but image transfer size and quality have not been measured.

**Revisit when:** Image loading contributes materially to measured public-page latency or bandwidth.

**Direction:** Compare existing thumbnails with appropriately sized variants or Next.js image optimization before adopting a loader or changing image delivery.

## Treat each Story directory as one aggregate

**Problem:** Separate Modules manage `story.json` and `images.json`, exposing partial directories and their coupling to callers.

**Revisit when:** A Story gains another artifact, partial directories cause workflow problems, or reset/validation becomes more complex.

**Direction:** One storage Module reads, writes, lists, validates, and removes the per-POI aggregate while keeping files separate.

## Report Story Workflow progress to the browser

**Problem:** Full generation exposes one overall running state, making long operations and partial failures hard to interpret.

**Revisit when:** Latency or recovery needs make that state insufficient.

**Direction:** Emit server progress for Sources, image candidates, and Story Content; deliver it through an Adapter without moving orchestration into the browser.

## Introduce a Curator read model

**Problem:** `loadPoiLists` joins Geo Places, POIs, Sources, Story Content, image candidates, and metadata in several passes. Growing merge logic risks becoming a second workflow implementation.

**Revisit when:** The table gains a workflow state, artifact, filter, or city view, or merging causes defects.

**Direction:** A server-side query projection assembled from POI/Story Workflow Modules, without write behavior or UI-owned workflow decisions.

## Use one generation metadata model

**Problem:** The Curator loader duplicates `GenerationStep` and `GenerationMetadata`, risking drift from persistence and workflow checkpoints.

**Revisit when:** A step is added/renamed, more checkpoint information is displayed, or metadata changes.

**Direction:** Consume the canonical type or domain Module's generation status, without exposing paths or storage JSON.

## Consider explicit Story approval

**Problem:** Draft and published content have no separate approval status. This is acceptable under current publication rules.

**Revisit when:** We explicitly choose an approval workflow; it is not a dependency of current publication or discovery.

**Direction:** Model approval and restrict visitor reads to approved Stories if adopted. Until then, retain public catalog eligibility.

## Model multiple Story Sources

**Problem:** One local Wikipedia snapshot uses Source ID `wikipedia`, with text and metadata under ignored `data/<city>/generated/wikipedia/`. References are validated during generation, but public `story.json` reads do not require the snapshot. This does not define multi-source identity, versions, replacement, citation granularity, or persistence.

**Revisit when:** A Story needs a second Source, source history, or visitor-visible Sources.

**Direction:** Define city-scoped identity, ownership, versions, storage, and document-versus-claim references. Migrate the snapshot without coupling Story Content or rendering to file layout.

## Check POI categories against Story Content

**Problem:** Categories may reflect a different historical/present use than the Story explains. A mismatch is not automatically an error.

**Revisit when:** Mapped POIs from #38 can be reviewed alongside their Stories.

**Direction:** Review concrete cases with a Curator before adding warnings. Keep category mapping independent of Story Content and account for changes of use.

## Localize historical date formatting

**Problem:** Numeric years are language-neutral, but the current English renderer uses forms such as `338 AD` and `264 BC`. Other locales or editorial conventions need different labels/order, such as `338 d.C.`.

**Revisit when:** Language selection or localized Story Content is introduced.

**Direction:** A locale-aware formatter owns era labels, placement, abbreviations, and centuries; preserve numeric years, precision, and granularity.

## Show related Points of Interest for People

Promoted to [#72](https://github.com/Papidev/historical-explorer/issues/72): connected published POIs in the current city, map/detail navigation, and a return path. Person discovery respects active filters; name search may temporarily reveal an excluded result.

## Preserve evidence for entity connections

**Problem:** Source IDs and identity-resolving Wikipedia links do not capture the passage establishing a significant connection. Resolution can be mistaken for validation.

**Revisit when:** Independent ranking, Wikidata discovery, or the first Event/Artifact is prioritized.

**Direction:** Retain supporting passages/statements internally, separately from identity resolution, without a formal relationship taxonomy. Coordinate new Sources with the multi-source entry.

## Discover related Events

**Problem:** History insights describe occurrences without reusable Event identities/details; broad periods could be mistaken for specific events.

**Revisit when:** We prioritize Event discovery and select real source-supported catalog examples.

**Direction:** Agree on boundaries, then deliver source acquisition, identity, and drawer details. Keep unsupported/ambiguous identities non-navigable; evaluate tabs with real content instead of introducing a general graph framework.

## Discover related Artifacts

**Problem:** Art insights mention works/objects without reusable identities/details. Objects that are also POIs risk duplicate identities.

**Revisit when:** We prioritize Artifact discovery and select source-supported works/objects.

**Direction:** Resolve POI overlap, then deliver a complete source-to-detail slice with connection evidence, without a general ontology.

## Complement Wikipedia entity discovery with Wikidata

**Problem:** Wikipedia selects People; Wikidata resolves identity but does not yet discover connections. Useful statements may be missed; broad imports risk irrelevant/duplicate candidates.

**Revisit when:** Real POIs reveal significant Wikipedia gaps supported by Wikidata.

**Direction:** Compare useful facts/connections from both sources, including identity/context differences. Add the smallest evidenced path, merge by resolved identity, and preserve Wikipedia discovery where structured data is absent. A statement alone does not establish editorial significance.

Categories/style remain in #38–#39, period filtering (#40) is deferred, and creator connections need a concrete future case.

## Evaluate Jev for ordering related People

**Problem:** Story generation currently selects and orders People together. Jev has not been evaluated; a ranker might favor fame/similarity or remove valid candidates.

**Revisit when:** Independent ordering is prioritized and connection evidence plus Curator-reviewed expected orders exist for People on 3–5 real POIs.

**Direction:** Verify API, availability, and suitability; compare against current ordering using the same valid People. Review quality, latency, cost, and failure behavior before integration. Require a permutation within one category, preserving identities/content. Ranking must not discover, validate, filter, add, or rewrite entities. Keep it replaceable and retain the existing order on failure/invalid output. Evaluate Events/Artifacts only after discovery exists; cross-category ranking is out of scope.
