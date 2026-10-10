# Person Architecture

## Identity and storage

Story generation selects at most ten significant Related People in order. It discards AI-supplied IDs; only the resolver assigns canonical app-owned Person IDs and retains Wikidata IDs as external identity.

Each Person lives once at `data/people/<person-id>/person.json`; source text is separate under `data/generated/people/`. Display names omit trailing Wikipedia disambiguation qualifiers without rewriting saved records. Full Wikipedia/source titles and stable IDs retain identity information.

A Person has a two-paragraph description, source-supported curiosities, optional exact or approximate birth/death dates, and at most one optional Commons image. Its internal Wikipedia Source is separate from Story Sources; Wikidata supplies identity and Commons image rights.

## Resolution

After Story generation, resolve names against preserved Wikipedia Source links. The prompt requests exact linked titles; omit prose-only names without personal links.

1. Match link titles and labels after normalizing Unicode, whitespace, underscores, and section anchors.
2. If no exact match exists, tolerate accents, apostrophe/dash variants, honorific prefixes, and disambiguation suffixes when the generated name has no qualifier.
3. Exclude disambiguation pages and merge redirects to the same canonical article. Proceed only when one personal article remains; do not use partial-name or spelling-distance guesses.
4. Merge repeated names/aliases for the same unique link, preserving Source IDs and existing Person IDs. Keep distinct resolved IDs separate; retrying saved references also deduplicates them.
5. Exclude names with no matching link or nonexistent pages, including on retry. Log missing pages as skipped rather than failed.
6. Reuse a Person with the same Wikidata ID; otherwise acquire its Wikipedia Source and generate using the selected Story model. Existing People are never regenerated as a side effect.

Ollama Cloud receives the JSON schema in the prompt and retries invalid output once. The resolver considers a reference resolved only when its Person ID points to a saved local record.

The Person module also owns local Source-link diagnostics shown in the Curator table, using the resolver's matching rules. Saved resolution failures take precedence; fallback diagnostics inspect retained links without fetching Wikipedia or deciding whether redirects identify the same Person.

## Failure and publication

Source or generation failure preserves Story Content and leaves the reference unresolved for Curator review and retry. Any retained unresolved or missing Person blocks the entire POI from the public catalog; a Story with no Related People may still qualify. Never invent people to satisfy completeness.

Persist a new Person after source acquisition and valid generation. Its optional image may fail without blocking the record. A source or AI-provider rate limit stops further Person attempts in that operation.

Generated People are immediately available internally. Public Person records are included only when referenced by a publishable POI.

## Curator actions

- Retry unresolved People from the saved Story without regenerating content or replacing resolved People.
- Browse the People tab alphabetically, with thumbnails, name search, Linked POIs counts, and a detail drawer. Associations derive from Story references by Person ID; repeated mentions count once per POI.
- **Regenerate** replaces description, curiosities, and dates from the saved Source using the selected AI model. Preserve ID, image, and Story links; keep the existing record on failure.

Manual editing, approval, and identity-resolution controls are outside this slice.

## Visitor navigation

All public Related People link to saved records. Selecting a Person replaces the Story in the existing drawer; Back returns to the original POI and closing returns to the map. Standalone Person pages are outside the current slice. Reverse map discovery is planned in [#72](https://github.com/Papidev/historical-explorer/issues/72); see [Entity Discovery](entity-discovery.md) for filter behavior.
