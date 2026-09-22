# Person Architecture

The Story Workflow discovers significant people while generating Story Content. A Story may reference at most ten people, ordered from most to least significant. Resolved references contain a stable Person ID; ambiguous references retain only the sourced display name.

Each Person is stored once under `data/people/<person-id>/person.json`. Its `id` is app-owned and its `wikidataId` is retained as an external identifier, following the same identity pattern as Points of Interest. Person source text is stored separately under `data/generated/people/`.

After Story Content generation, the workflow resolves each generated name against links preserved from the POI's Wikipedia source. It reuses a Person with the same Wikidata ID or, when none exists, acquires that person's Wikipedia source and performs one additional structured generation. It normally uses the AI mode and model selected for the Story. Because Ollama Cloud does not support structured outputs, a Story generated with Cloud Ollama automatically uses the configured local Ollama model (`LOCAL_AI_MODEL`) for new People. Existing People are never regenerated as a side effect of Story generation.

A Person contains a two-paragraph description, any number of source-grounded curiosities, optional exact or approximate birth and death dates, and at most one optional Wikimedia Commons image. Its Wikipedia content Source is separate from the Story Sources and remains internal; Wikidata supplies canonical identity, while Commons supplies image and rights metadata.

Person resolution is failure-isolated from Story Content. If source acquisition or generation fails for a Person, the Story is still persisted and available, while that name remains an unresolved, non-navigable reference. A new Person is persisted only after source acquisition, structured generation, and image discovery succeed. A provider rate limit stops further Person attempts in the same operation so it does not create avoidable requests.

People become available automatically after successful generation. The Curator can retry only unresolved People from the saved Story without regenerating Story Content; already resolved People are preserved. This slice does not add editing, approval, Person regeneration, or manual identity resolution controls.

In the Visitor Experience, resolved names in Related People are links and unresolved names are plain text. Selecting a resolved Person replaces the POI Story inside the existing drawer; Back returns to the same POI and closing the drawer returns to the map. Standalone Person pages and reverse Person-to-POI navigation are outside the first version.
