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
- proposing concise text
- suggesting which medium best communicates each insight
- proposing candidate media
- explaining why each insight is useful

The AI draft is only a proposal. A human curator reviews, edits, rejects, enriches, and approves the final content.

### Visitor world

This is the public app experience.

The visitor only sees polished, approved content. They should not see AI reasoning, drafts, source processing, or editorial metadata.

The visitor experience should be quick, pleasant, low-friction, and useful while physically looking at a place.

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

Do not design flows where AI directly publishes final POI content without human review.

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
