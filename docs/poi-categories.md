# POI Categories

Status: direct-type mapping, visitor sidebar (#59), and shared Curator edits (#60) are implemented. Per-POI exceptions (#61) remain planned.

## Domain and hierarchy

POI Types are Wikidata source classifications; Categories are an editable app-owned vocabulary shared across cities, separate from Story Content. Membership may reflect current or historical nature/function and does not promise current use, opening hours, or access. A Story/category difference may reflect a change of use.

Category names are singular; visitor labels may be plural. The initial vocabulary is Churches & cathedrals, Cathedral, Basilica, Church, Museum, Castle, Mausoleum, Aqueduct, Amphitheatre, Arch, Square, and Archaeological Site.

The hierarchy has two levels. Each child has one top-level parent; categories with children cannot be nested. Churches & cathedrals contains Cathedral, Basilica, and Church, displayed as Cathedrals, Basilicas, and Churches. This hierarchy is independent of Wikidata's.

In Manage categories, drag a child or top-level leaf onto a parent, or onto Top level to detach it. Moving preserves IDs and selected children, updates shared rules to the new parent, and removes the old parent assignment when none of its children remain assigned. Renaming preserves IDs and assignments; AI-created categories start at the top level.

Deleting a parent deletes its children and removes all deleted assignments from shared rules and POIs. Rules left empty become manually cleared Unmapped. Deleted names and original IDs are retained to prevent AI recreation.

## Type mapping

Use direct non-deprecated Wikidata P31 types with their IDs and labels; do not traverse P279. A type may map to several categories; a POI receives their deduplicated union.

- An absent rule is **Unmapped**; an explicit empty category list is **Ignored**.
- Missing or unknown types preserve the POI. Mapping gaps do not make otherwise complete Story Content incomplete.
- Assigning a parent selects all children; assigning a child includes its parent without its siblings.
- A saved parent with explicit children preserves that subset; a parent alone selects all children.
- Clearing a parent clears its children. Clearing one child preserves siblings and removes the parent only when no children remain.
- Explicit parent assignments preserve the selected religious children; the name refinement below applies to legacy leaf-only rules.

Civil basilica `Q2887138` is explicitly ignored and assigns neither Basilica nor Church. The Constantinian basilica ruins and present Sant'Agnese fuori le mura church remain distinct POIs. Archaeological Site requires another suitable direct type or a future exception; classification must not rewrite source identity or merge places.

## Automatic classification

Generate/Refresh types classify newly acquired unmapped types using the selected admin AI; **Classify unmapped types** handles existing gaps. Inputs include type IDs/labels, affected-place examples, the current catalog, and deleted names.

Reuse categories first, create concise singular English categories when needed, ignore broad/administrative types, and leave uncertainty unmapped. Validate output before saving; automatic rules retain their origin and short explanation.

Preserve seeded rules, ignored types, and manual corrections. Manually cleared types are not automatically retried; recheck current rules after the AI response so concurrent manual edits win. Classification failure preserves acquired types; retry from Type mappings.

## Visitor filtering

The discovery sidebar is collapsible on mobile. All available categories start selected, showing all published POIs including uncategorized ones. Children start collapsed; expansion does not change selection. Hide zero-count categories; counts use the full visitor-ready catalog.

| Action | Effect |
| --- | --- |
| Select/clear a parent | Select/clear all children. |
| Deselect a child | Clear the parent's selected state; retain other children. |
| Select several categories | Match any selected category (OR). |
| Clear all categories | Show all published POIs, including uncategorized ones. |
| Exclude the open POI | Close its detail and clear selection. |

Active category subsets exclude uncategorized POIs. Religious child scopes are disjoint. For legacy mapped religious types, catalog naming determines the scope:

- Basilica in the name selects Basilica, even for a cathedral.
- Cathedral requires Cathedral or Cattedrale, case-insensitive.
- Otherwise use Church; these rules never classify ignored civil basilicas.

After naming refinement, configured precedence is Cathedral over Basilica/Church, then Basilica over Church. Source types stay unchanged; child counts sum to the parent, and counts/detail retention use the same rules.

The planned name-search visibility exception is described in [Entity Discovery](entity-discovery.md#agreed-discovery-and-search-filter-behavior).

## Curator workflow

Type mappings lists acquired direct types across cities, with IDs, labels, assignments, and affected POIs. Search by label/ID and filter Mapped/Unmapped. **Show ignored types** reveals ignored rules and enables the Ignored filter.

Select a type to edit it: **Save categories** assigns existing categories, **Ignore type** saves an empty list, and **Clear rule** removes its rule. **Manage categories** controls the shared hierarchy.

Saving a rule immediately recalculates affected POIs from local type snapshots across cities, preserving unrelated records and Story artifacts. Revalidate admin/visitor routes and notify an open map in the same browser to refresh. Shared versioned rules survive type refresh and POI regeneration; neither Story regeneration nor per-POI approval is needed.

## Planned per-POI exceptions

[#61](https://github.com/Papidev/historical-explorer/issues/61) allows additions/exclusions when a global rule does not fit a specific POI, including those without Wikidata types. Manual additions require no explanation or Source.

Final categories are `(mapped union + additions) - exclusions`; exclusions win. Exceptions survive refreshes, mapping changes, and regeneration until removed, restoring shared mapping behavior. Continue reporting unmapped types even when manual categories suffice for filtering.

Use exceptions for source types describing an encompassing complex rather than the specific place, without altering generally correct shared rules.

## Persistence

| Artifact | Location |
| --- | --- |
| Shared category definitions | `data/poi-category-catalog.json` |
| Versioned direct-type rules | `data/poi-type-category-map.json` |
| Persisted categories by POI ID | `data/<city>/pois/categories.json` |
| Defaults for older catalogs | `src/types/PoiCategory/` |

Definitions contain stable `id`, singular `name`, optional visitor `label`, top-level `parent`, and `supersedes`. Shared configuration drives grouping, counts, and filtering without Basilica-specific browser logic.

Type acquisition/refresh and POI generation recompute categories. Run `pnpm categories:rebuild` to apply current rules across local city snapshots. The server/public snapshot combines definitions, categories, and POI catalog; the browser filters persisted values.

See [#38](https://github.com/Papidev/historical-explorer/issues/38), the [glossary](../CONTEXT.md), and the [consistency backlog](backlog.md#check-poi-categories-against-story-content).
