# POI Categories

Status: automatic direct-type mapping and sidebar filtering are implemented in the #59 slice. Curator mapping edits (#60) and per-POI exceptions (#61) remain planned.

## Agreed domain decisions

POI Types are source classifications from Wikidata; POI Categories are the app-owned vocabulary used for visitor discovery. Categories and their type mappings are shared across cities, so a category has the same meaning throughout Cultural Atlas.

Churches & cathedrals is a top-level POI Category with Cathedral, Basilica, and Church as its children, displayed as Cathedrals, Basilicas, and Churches. Each subcategory has one parent chosen from the top-level categories. There is one level of subcategories, with no deeper nesting. This app-owned hierarchy is independent of the Wikidata type hierarchy.

Category names use the singular, for example Church, Basilica, and Museum. Membership can reflect a current or historical nature or function: a former church or church ruins can belong to Church. Membership does not promise current religious use, opening hours, or visitor access.

A Curator may add a category to a POI even when it has no Wikidata types. Manual additions require neither an explanation nor a source; this is an editorial classification decision, separate from the source requirements for Story Content.

The shared type mapping supplies the base categories. The Curator may explicitly add or exclude categories for an individual POI when the global rule does not fit that place. Place-specific exceptions avoid changing a generally correct rule or altering source classifications to accommodate one case. Final categories are the union of categories from all mapped direct POI Types and manual additions, minus manual exclusions. Exclusions take precedence. Additions and exclusions survive source-type refreshes, global mapping edits, and POI regeneration until the Curator explicitly removes them. Removing an exception restores the shared mapping behavior for that category.

Categories remain separate from Story Content. A changed Story does not itself redefine category membership, and a difference between Story and category may reflect a historical change of use rather than a contradiction.

## Agreed first mapping scope

Map direct Wikidata types explicitly; do not inherit categories through the Wikidata type hierarchy in the first version. A type may map to several categories, and a POI receives the union of the categories assigned by its types before its exceptions are applied.

The initial shared vocabulary is Churches & cathedrals, Cathedral, Church, Basilica, Museum, Castle, Mausoleum, Aqueduct, Amphitheatre, Arch, Square, and Archaeological Site. Broad or administrative source classifications may be explicitly ignored rather than becoming visitor categories. The first version uses a fixed vocabulary; the Curator may assign existing categories but cannot create or rename categories from the admin.

## Agreed visitor filter scope

All available categories and subcategories start selected, with all places visible including uncategorized places. Subcategories start collapsed. Expanding or collapsing them does not change the selection. Categories and subcategories with zero items are hidden; counts use the full visitor-ready catalog rather than the currently filtered results. Selecting Churches & cathedrals selects all three children; clearing it clears all three. Deselecting a child clears the parent selection and retains the remaining selected children. Child discovery scopes are disjoint. For mapped religious buildings, Basilica in the catalog name selects Basilica even if the source also calls the place a cathedral. Cathedral is assigned only when the catalog name contains Cathedral or Cattedrale (case-insensitive). A cathedral type without that name is classified as Church unless Basilica applies. Name rules do not classify ignored civil basilicas. Filtering uses the configured precedence after these name rules: Cathedral supersedes Basilica and Church, and Basilica supersedes Church. Source types remain unchanged. The three child counts sum to the parent count. Counts and open-detail retention use the same rules.

The visitor may select multiple POI Categories at the same time. A POI matches when it belongs to at least one selected category (OR semantics). For example, selecting Church and Museum includes POIs in either category or both. With no category selected, all POIs remain visible. If the filter excludes the currently open POI, close its detail view and clear its selection.

## Implementation boundaries

[Issue #38](https://github.com/Papidev/historical-explorer/issues/38) contains the original scope. The later agreed changes recorded here group Cathedral, Basilica, and Church under Churches & cathedrals and explicitly ignore civil basilica types, superseding the original flat-category and civil-basilica mapping requirements. An absent mapping rule means unmapped; an explicit empty category list means ignored. Missing or unknown types preserve the POI.

The Constantinian basilica ruins and the present church of Sant'Agnese fuori le mura remain distinct POIs. Civil basilica Q2887138 is explicitly ignored: it assigns neither Basilica nor Church. Its source classification is retained. Civil Basilica is not a visitor category; another category such as Archaeological Site requires a suitable direct type or a future per-POI exception.

Current type acquisition uses direct non-deprecated Wikidata P31 classifications, preserves their IDs and labels, and does not traverse the P279 hierarchy. The fixed top-level vocabulary and subcategory records (`name`, display `label`, top-level `parent`, and `supersedes` precedence) live in `src/types/PoiCategory/`. Sidebar grouping, parent-inclusive counts, filtering, and open-detail retention use this shared configuration; no Basilica-specific filtering branch is needed. Versioned direct-type rules live in `data/poi-type-category-map.json`. Category lists are persisted by POI ID in `data/<city>/pois/categories.json`, separate from the GeoJSON catalog. The server combines the catalog and saved categories for the visitor map. Type acquisition/refresh and generation update them; `pnpm categories:rebuild` applies the current rules across existing city catalogs using their local type snapshots. The browser filters persisted categories only.

## Planned curator behavior

Report unmapped types in the shared type-mapping section even when a POI already has manual categories. Manual categories are sufficient for visitor filtering; an unmapped type does not make that POI incomplete. Keep unmapped types distinct from explicitly ignored types.

Editing a shared mapping immediately updates the persisted categories of all affected POIs across cities, preserving manual additions and exclusions. No Story regeneration or per-POI approval is required for the category update.

When a source type describes an encompassing complex rather than the specific POI, the Curator may use a POI Category Exception to correct the place's categories. A classification issue must not silently merge distinct places or rewrite their source identities.

See the [domain glossary](../CONTEXT.md), [entity discovery](entity-discovery.md), and [Story/category consistency backlog](backlog.md#check-poi-categories-against-story-content).
