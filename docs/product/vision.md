# Historical Explorer - Project Context

Historical Explorer is a visit companion for art, history, and cultural discovery.

The app helps tourists understand what they are seeing while they are visiting a city. It turns points of interest into concise, engaging cultural discoveries using text, images, maps, timelines, and other media when they are the best medium for the insight.

## Product philosophy

The app is not a Wikipedia clone, a generic tourist guide, or an AI-generated article system.

The goal is to help visitors:
- notice meaningful details
- understand what they are looking at
- connect a place to art, history, culture, people, and the city
- remember something valuable after the visit

Each point of interest should become a small curated visitor experience, not a complete encyclopedia page.

## Production world vs visitor world

There are two separate worlds:

### Production world

This is the internal editorial workflow.

A POI starts from source material such as Wikipedia, Wikidata, and Wikimedia Commons. AI helps create a first draft by:
- extracting visitor-oriented insights
- proposing concise story prose
- suggesting which medium best communicates each insight
- proposing one main image
- explaining why each insight is useful

The AI draft is only a proposal. A human curator reviews, edits, enriches, or approves draft stories.

### Visitor world

This is the public app experience.

The visitor only sees approved stories. They should not see AI reasoning, drafts, source processing, visitor insights, or editorial metadata.

The visitor experience should be quick, pleasant, low-friction, and useful while physically looking at a place.

## Current product decisions

The primary product mode is a visitor who is near, or interested in, a specific POI and wants a concise cultural explanation. Planning, nearby discovery, post-visit review, and deeper reading are interesting future modes, but the first product shape should optimize the POI visit companion experience.

Each POI should have one canonical English story. The story prose should be self-contained, source-grounded, and concise: aim for 120-180 words, with about 220 words as a soft upper bound. It should be written as continuous prose, not as a rigid set of cards or encyclopedia sections.

The tone should be warm, precise, and visitor-facing without becoming promotional, academic, or presence-assuming. Avoid wording like "you are looking at" or "in front of you" because the visitor may be browsing away from the POI. Soft observation prompts are acceptable when useful, such as "a detail worth noticing is..."

AI may propose lightweight bold highlights inside the story prose, but highlights are plain editorial markup, not structured metadata. They should only emphasize proper names of places, named people or historical figures, dates or periods, named historical events, and named artistic movements. Apart from dates and periods, a highlighted phrase must be a named entity. Generic nouns, roles, amenities, facilities, services, functions, materials, objects, and concepts should not be bold unless they are part of one of those allowed proper names. A human curator can adjust or remove them before approval.

Each story needs one required main image. The main image should help the visitor recognize the place or notice an important visible detail, not merely decorate the page. It should live outside the story prose and include source, author or rights status, license, and attribution metadata before approval.

For the first AI story workflow, AI should produce:
- a concise English draft story
- proposed lightweight bold highlights
- one proposed main image with source, license, and attribution metadata, chosen from three Wikimedia Commons recognizer candidates
- source material used to ground the draft story

Main image candidate discovery should be the last Story Workflow step and should be started manually, after the draft story prose exists. It should be retryable independently from story prose generation.

The first source pipeline should stay limited to Wikipedia, Wikidata, and Wikimedia Commons. Source material and draft metadata belong to the story workflow and should not be shown in the default visitor experience. A future "learn more" section may expose selected sources when that adds useful depth without slowing down the core visit companion experience.

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

Do not design flows where AI directly publishes final stories without human review.

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
