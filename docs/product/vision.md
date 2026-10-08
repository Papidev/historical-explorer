# Cultural Atlas - Project Context

Cultural Atlas is a visit companion for art, history, and cultural discovery.

The app helps tourists understand what they are seeing while they are visiting a city. It turns points of interest into concise, engaging cultural discoveries using text, images, maps, timelines, and other media when they are the best medium for the insight.

## Product philosophy

The app is not a Wikipedia clone, a generic tourist guide, or an AI-generated article system.

The goal is to help visitors:

- notice meaningful details
- understand what they are looking at
- connect a place to art, history, culture, people, and the city
- remember something valuable after the visit

Each POI should become a small curated visitor experience, not a complete encyclopedia page.

The map should be selective: places belong because of their historical, artistic, architectural, archaeological, or cultural significance. Restaurants, hotels, shops, and other businesses should not appear merely because they are useful to tourists; a place may still qualify through its own cultural or historical significance. Extending this scope to places valued primarily for natural interest remains a product decision.

## Discovery through connections

A visitor should eventually be able to move from a POI to a connected Person, Event, or Artifact, then discover other places through that connection. For example, opening a person associated with a palace could reveal other places connected to that person.

Spatial discovery answers "What is interesting around here?"; discovery through connections answers "What else is connected to this?". Selecting a Person should eventually let the visitor see associated POIs on the map. For discovery, knowing that a POI is connected is sufficient; its Story should explain why the connection matters without requiring a relationship label in the filter.

People are the first implemented path. Events and Artifacts are future extensions: Events represent significant historical occurrences connected to a place; Artifacts represent culturally significant works or objects connected to it. Their detailed boundaries should be agreed on using real catalog examples before implementation.

These connections form a knowledge graph in the domain, without requiring a graph visualization or dedicated graph database. The visitor should encounter simple lists and useful detail views. People, Events, and Artifacts tabs are a possible presentation to evaluate once there is real content for each category.

Discovering a supported connection and ordering supported connections are separate responsibilities. Ranking should order entities within each category by the historical or cultural significance of their connection to the POI. Jev is a candidate for this future ordering step only; it must not discover, validate, filter, or add entities.

The first extension should use simple, source-supported connections without requiring formal relationship types or generated prose for every relationship. Automatic "must-see" selections, ranking across categories, and explicit graph visualization remain outside the initial scope. See [Entity discovery](../entity-discovery.md) for current behavior and future boundaries.

## Production world vs visitor world

There are two separate worlds:

### Production world

This is the internal editorial workflow.

A POI starts from source material such as Wikipedia, Wikidata, and Wikimedia Commons. AI helps create a first draft by:

- extracting visitor-oriented insights
- proposing concise structured Story Content
- suggesting which medium best communicates each insight
- proposing one main image
- explaining why each insight is useful

AI-generated content is reviewable editorial material. A human curator can review, edit, and enrich it. An explicit approval step is a possible future evolution, not a current publication requirement.

### Visitor world

This is the public app experience.

The visitor sees publishable stories from the public catalog. Publication currently requires valid versioned Story Content, a selected main image with license and attribution, and saved Person records for all Related People; it does not require an explicit Curator approval state. They should not see AI reasoning, drafts, source processing, visitor insights, or editorial metadata.

The visitor experience should be quick, pleasant, low-friction, and useful while physically looking at a place.

## Current product decisions

The primary product mode is a visitor who is near, or interested in, a specific POI and wants a concise cultural explanation. Browsing the map and exploring POIs from home before a visit are part of the same experience; physical presence is not required. Dedicated itinerary planning, expanded nearby discovery, post-visit review, and deeper reading remain possible future modes, while the first product shape should optimize the POI visit companion experience.

Each POI should have one canonical English story. Its primary content is structured, source-grounded, and concise: a required introduction followed by supported history, design, and art insights, plus related people. Topics may be empty and unsupported material must be omitted. The structure carries content semantics, while React components own its public presentation.

The tone should be warm, precise, and visitor-facing without becoming promotional, academic, or presence-assuming. Avoid wording like "you are looking at" or "in front of you" because the visitor may be browsing away from the POI. Soft observation prompts are acceptable when useful, such as "a detail worth noticing is..."

Story Content contains plain text without Markdown, inline highlights, CSS, or presentation components. It is the sole textual content artifact for a story. MDX and configurable React renderers remain future decisions.

Each story needs one required main image. The main image should help the visitor recognize the place or notice an important visible detail, not merely decorate the page. It should live outside Story Content and include source, author or rights status, license, and attribution metadata before publication.

For the first AI story workflow, AI should produce:

- concise English Story Content with source references on its introduction, insights, and related people
- one proposed main image with source, license, and attribution metadata, chosen from three Wikimedia Commons recognizer candidates
- source material used to ground the draft story

Main image candidate discovery should run after Wikipedia source acquisition and before Story Content generation. It should remain retryable independently from Story Content generation. The workflow should keep an existing available selection or automatically select the first candidate with license and attribution; the curator may review and change that selection. Full Generate produces Story Content.

The admin dashboard should let the curator choose the AI provider for the current admin session, switching between local AI through Ollama and cloud AI through Gemini or Ollama Cloud without rewriting environment configuration. The selector should use the concise choices "Local" and "Cloud", with a secondary line explaining the concrete provider, model, and cost implication. When Ollama Cloud is active, the panel should show both models used by the pipeline: the Cloud model for Story Content and the configured local Ollama model for structured Person generation. `AI_MODE` should choose the initial Local/Cloud selection, while `LOCAL_AI_PROVIDER`, `LOCAL_AI_MODEL`, `CLOUD_AI_PROVIDER`, and `CLOUD_AI_MODEL` configure the concrete backends. These variables are the primary AI configuration shape. The selected provider and model should be submitted with each manual AI workflow action.

The first source pipeline should stay limited to Wikipedia, Wikidata, and Wikimedia Commons. Source material and draft metadata belong to the story workflow and should not be shown in the default visitor experience. A future "learn more" section may expose selected sources when that adds useful depth without slowing down the core visit companion experience.

Filterable POI metadata should remain separate from Story Content. Categories, architectural styles, and historical periods support discovery; the Story explains the place's significance. Prefer structured source facts for filters where available, preserving source identity and date precision before mapping them to app-owned values. Wikipedia remains both a narrative source and a source of connections absent from Wikidata. These are complementary roles, without treating either source as complete or infallible. Category, style, and period filters are already planned in issues [#38](https://github.com/Papidev/historical-explorer/issues/38), [#39](https://github.com/Papidev/historical-explorer/issues/39), and [#40](https://github.com/Papidev/historical-explorer/issues/40).

The map remains the entry point for discovery, but the story is the main value moment. Selecting a marker should first show a lightweight identifiable preview, because a marker alone does not tell the visitor what it represents. The preview should include the POI name, a small thumbnail, a short descriptor, and an action to open the full story.

## Core content principle

Insight first. Medium second.

Use text, image, map, timeline, or another medium only when that medium best communicates the specific cultural insight.

Do not add media just because it makes the page look rich. If concise, engaging text communicates the idea best, use text.

## Editorial rule

Every published discovery should help the visitor do at least one of these:

- See: notice something visible
- Understand: grasp what they are looking at
- Connect: relate the POI to history, art, culture, people, or the city
- Remember: leave with a meaningful cultural takeaway
- Navigate: understand a nearby or spatial relationship

A true fact is not automatically worth publishing. The final experience should contain the best few discoveries, not all available information.

## AI role

AI is a junior cultural editor, not the final authority.

AI may help draft, classify, summarize, rank, and propose. The human curator has the final word.

The current application does not enforce human review through an approval state. Generated content becomes eligible for the public catalog when the current publication requirements are met and reaches the public site through deployment. Explicit Curator approval may be introduced later; it is not a prerequisite for the current product or new discovery paths.

## Content quality risks

Avoid:

- long article-like summaries
- generic tourist-guide prose
- too many cards, clicks, or sections
- decorative media with no clear purpose
- unsupported claims
- invented facts, coordinates, media, or licenses
- treating all POIs with the same rigid template

Prefer:

- concise, engaging, source-grounded insights
- block-by-block human review
- visible source support for draft content
- media chosen because it communicates an insight better
- optional depth only when it adds value
