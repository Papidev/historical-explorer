# Person Profile Architecture

The Story Workflow discovers significant people while generating Story Content. A Story may reference at most ten people, ordered from most to least significant. Resolved references contain a stable Person ID; ambiguous references retain only the sourced display name.

Each Person has one global canonical profile under `data/people/<person-id>/profile.json`. The Person ID is app-owned and the Wikidata ID is retained as an external identifier, following the same identity pattern as Points of Interest. Profile source text is stored separately under `data/generated/people/`.

After Story Content generation, the workflow resolves each generated name against links preserved from the POI's Wikipedia source. It reuses a profile with the same Wikidata ID or, when none exists, acquires that person's Wikipedia source and performs one additional structured generation using the same AI mode and model selected for the Story. Existing profiles are never regenerated as a side effect of Story generation.

A profile contains a two-paragraph description, any number of source-grounded curiosities, optional exact or approximate birth and death dates, and at most one optional Wikimedia Commons image. Its Sources are separate from the Story Sources and remain internal.

The first implementation assumes successful generation. A Person Profile error fails the Story generation action; failure isolation and partial-result status are deferred until real failures reveal the needed behavior. Profile replacement occurs only after source acquisition, structured generation, and image discovery succeed.

The Curator UI has a global People table for viewing and explicitly regenerating profiles with the currently selected AI mode and model. It does not initially support editing, approval, or manual identity resolution. Profiles are published automatically.

In the Visitor Experience, resolved names in Related People are links and unresolved names are plain text. Selecting a resolved Person replaces the POI Story inside the existing drawer; Back returns to the same POI and closing the drawer returns to the map. Standalone Person routes and reverse Person-to-POI navigation are outside the first version.
