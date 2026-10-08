# Cultural Atlas — Product Vision

Cultural Atlas helps visitors understand places through concise discoveries across art, history, and culture. It works during a visit and when exploring from home; physical presence is not required.

## Product philosophy

Each POI should offer a small cultural experience rather than an encyclopedia summary or generic tourist guide. Every insight should help the visitor notice a detail, understand the place, connect it to a wider context, remember something meaningful, or navigate a spatial relationship.

Choose the strongest few source-supported ideas. Use text, images, maps, timelines, or other media only when they communicate those ideas well. Avoid promotional prose, decorative media, rigid templates, and excessive sections or clicks. Optional depth should add value without slowing the core experience.

The map includes places with historical, artistic, architectural, archaeological, or cultural significance. Businesses qualify through that significance, not merely through tourist usefulness. Places valued primarily for natural interest remain an open scope decision.

## Visitor experience

The map is the discovery entry point; the Story explains why a place matters. Selecting a marker should show a lightweight preview with the POI name, thumbnail, short descriptor, and an action to open the Story.

A POI appears only when it has workflow-generated, valid versioned Story Content, a selected Main Image with source, rights, license, and attribution, and saved records for every retained Related Person. Imported places and metadata-only POIs remain internal. Explicit approval is a possible future evolution, not a current requirement; content reaches the public site through deployment.

“Insight” means cultural content shown to the visitor. Unpublished proposals are draft content; internal rationale is Editorial Notes. Sources, processing metadata, AI reasoning, and Editorial Notes stay out of the default visitor experience. Selected sources may later appear in a useful “learn more” section.

Dedicated itinerary planning, expanded nearby discovery, post-visit review, and deeper reading remain possible future modes.

## Stories and editorial work

Each POI has one canonical English Story: a required introduction, supported history/design/art content, and Related People. Omit unsupported material; topics may be empty and need not become separate UI sections.

Write warm, precise contemporary English without promotional or academic language. Avoid assuming the reader is at the place, such as “you are looking at.” Useful observation prompts such as “a detail worth noticing is...” are acceptable.

Story Content is structured plain text without Markdown, inline highlights, CSS, or presentation components. React owns presentation; MDX and configurable renderers remain future decisions. The Main Image is separate from Story Content and should help recognize the place or notice a meaningful visible detail.

AI drafts source-grounded content, proposes an image, and may suggest suitable media and editorial rationale. The Curator can review individual content blocks, edit, and enrich them; AI is not the final editorial authority. Draft introductions, topic items, and Related People retain Source References for review. Never invent facts, coordinates, media, or licenses.

The first pipeline uses Wikipedia, Wikidata, and Wikimedia Commons. It acquires Sources, discovers up to three Commons recognizer images, preserves an eligible current selection or chooses the first licensed and attributed candidate, then generates Story Content. Image discovery is independently retryable. See [Story Workflow Architecture](../story-workflow-architecture.md).

The admin session selects Local or Cloud AI, with provider, model, and cost information. Story and Person generation use the selected model without a separate local model requirement. Configuration belongs in the [README](../../README.md#ai-configuration).

## Discovery through connections

Visitors should move from a POI to a Person, Event, or Artifact and discover other connected places. The association enables discovery; the POI Story explains its meaning without requiring relationship labels such as “visited” or “commissioned.”

POI-to-Person details are implemented; Person-to-POI map navigation is planned. Events are significant historical occurrences; Artifacts are culturally significant works or objects. Define their boundaries using catalog examples before implementing them. Simple lists and detail views come first; category tabs can be evaluated when real content exists.

Discovery and ranking are separate. Ranking orders supported connections within a category by their significance to the place. Jev is an unadopted candidate for ranking only. Formal relationship taxonomies, prose for every connection, automatic “must-see” selections, cross-category ranking, graph visualization, and dedicated graph storage are outside the initial scope. See [Entity Discovery](../entity-discovery.md).

## Filter metadata

Categories and architectural styles remain separate from Story Content: filters support discovery, while the Story explains significance. Prefer structured facts where available, retaining source identity and precision. Wikipedia can supply context and connections absent from Wikidata; neither source is complete or infallible.

Category and style work is tracked in [#38](https://github.com/Papidev/historical-explorer/issues/38) and [#39](https://github.com/Papidev/historical-explorer/issues/39). Historical period filtering [#40](https://github.com/Papidev/historical-explorer/issues/40) is deferred.

See [CONTEXT.md](../../CONTEXT.md) for domain vocabulary and core rules.
