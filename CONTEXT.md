# Historical Explorer

Historical Explorer helps visitors understand cultural points of interest through concise, curated discoveries.

## Language

**Point of Interest**:
An app-ready place or object on the map that may have metadata and a story.
_Also_: POI
_Avoid_: Clean POI, polished POI, transformed POI, spot, location, attraction

**Raw POI**:
A point of interest as it arrives from a source dataset before irrelevant fields are removed.
_Avoid_: Raw feature, source feature

**Story Workflow**:
The internal process that gathers sources and creates, reviews, edits, enriches, and approves draft stories.
_Avoid_: Draft Workflow, production workflow, admin workflow

**Curator**:
The human decision-maker who reviews, edits, enriches, and approves draft stories.
_Avoid_: Admin, editor, reviewer

**POI Metadata**:
Basic identifying information for a **Point of Interest**, such as name, location, city, period, Wikidata ID, and short descriptor.
_Avoid_: Visitor narrative, curated content, story metadata

**Story**:
The approved source-grounded visitor-facing explanation for one **Point of Interest**, including prose and a main image.
_Avoid_: POI Story, Visitor Narrative, article, summary, description, AI text, Markdown

**Draft Story**:
A source-grounded visitor-facing story for one **Point of Interest** before curator approval.
_Avoid_: Draft POI Story, POI Draft, draft narrative, AI Markdown, AI text, Markdown, generated output

**Story Prose**:
The written part of a story.
_Avoid_: Story body, narrative, article, summary, description, Markdown

**Visitor Insight**:
A selected idea that makes a **Point of Interest** worth noticing, understanding, connecting to, remembering, or navigating.
_Avoid_: Fact, section, card, reasoning

**Main Image**:
The image in a story that helps visitors recognize a **Point of Interest** or notice an important visible detail.
_Avoid_: Lead Image Candidate, decoration, gallery image

**Source**:
External cultural material used to ground or review a draft story.
_Avoid_: Source Material, claim reference, citation

**Visitor Experience**:
The public-facing experience that shows approved stories to visitors.
_Avoid_: Production output, AI output

## Relationships

- A **Raw POI** may become a **Point of Interest** when source data is cleaned for app use.
- A **Story Workflow** creates or updates the current **Draft Story** for a **Point of Interest**.
- A **Story** belongs to exactly one **Point of Interest**.
- A **Point of Interest** has at most one approved **Story** in the current product.
- A **Point of Interest** has at most one current **Draft Story**.
- A **Story** contains one **Story Prose** and one **Main Image**.
- **Story Prose** may include lightweight editorial formatting.
- Editorial highlights are optional lightweight markup within **Story Prose**, not separate metadata.
- A **Story** may make substantive claims only when they are supported by its **Sources**.
- A **Story** retains the **Sources** used to support curator review.
- A **Story** is composed from the strongest few **Visitor Insights**, not from a complete article summary.
- A **Draft Story** proposes the **Visitor Insights** that may shape the approved **Story**.
- A **Draft Story** becomes a **Story** only when approved by a **Curator**.
- A **Draft Story** contains draft prose and one or more **Sources**, and may include zero or more editorial highlights and one proposed **Main Image**.
- A **Draft Story** must include one proposed **Main Image** with source, rights, license, and attribution information before it becomes a **Story**.
- The first **Main Images** come from Wikimedia Commons.
- A **Visitor Insight** should prefer visible details when they can carry the cultural meaning.
- The first **Sources** come from Wikipedia, Wikidata, and Wikimedia Commons.
- A **Curator** may edit a **Draft Story** before approving it.
- A **Story** may become visitor-facing only when approved by a **Curator**, regardless of whether it began as AI-generated or manually written content.
- **POI Metadata** identifies a **Point of Interest** but is separate from its **Story**.
- The **Visitor Experience** shows **Story** content.
- The default **Visitor Experience** does not show **Sources**.
- The default **Visitor Experience** does not show **Visitor Insights** directly.
- The **Visitor Experience** may show **POI Metadata** when a **Story** is unavailable.

## Example dialogue

> **Dev:** "Can the **Story Workflow** publish a generated story directly to the **Visitor Experience**?"
> **Domain expert:** "No — it can only create a **Draft Story**. A **Curator** must approve it before it becomes a **Story**."

## Flagged ambiguities

- "production workflow" was used to mean the internal AI-assisted editorial process — resolved: call this the **Story Workflow**.
- "Wikipedia-only source material" was used for the current first slice — resolved: first **Sources** may come from Wikipedia, Wikidata, and Wikimedia Commons, while implementation may begin with Wikipedia article text.
- "published POI content" implied a release destination — resolved: call the human-approved visitor-facing output a **Story**.
- "MDX narrative" was used for the story body — resolved: describe it as lightweight editorial formatting in **Story Prose** and keep MDX out of the product language.
- "AI Markdown" and "AI text" were used for the current reviewable artifact — resolved: call the domain object a **Draft Story**.
- "lead image candidate" over-specified the current image model because the draft workflow proposes only one image for now — resolved: call the image inside a story the **Main Image**.
