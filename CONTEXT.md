# Historical Explorer

Historical Explorer helps visitors understand cultural points of interest through concise, curated discoveries.

## Language

**Point of Interest**:
An app-ready place or object on the map that may have metadata and a story.
_Also_: POI
_Avoid_: Clean POI, polished POI, transformed POI, spot, location, attraction

**Geo Place**:
The geographic representation of a place from a source dataset before irrelevant fields are removed and it becomes a **Point of Interest**.
_Avoid_: Raw POI, Raw Place, Raw Location, Raw feature, source feature

**POI ID**:
A stable, human-readable identifier assigned by Historical Explorer to a **Point of Interest**, independent of identifiers from external sources.
_Avoid_: Wikidata ID, content slug

**Story Workflow**:
The internal process that takes a **Point of Interest** through **Draft Story Generation** and **Story Curation** until it has an approved **Story**.
_Avoid_: Draft Workflow, production workflow, admin workflow

**Draft Story Generation**:
The automated part of the **Story Workflow** that gathers **Sources** and creates or updates a **Draft Story**, its **Main Image Candidates**, and its **Draft Main Image**.
_Avoid_: Generation Pipeline, AI pipeline, draft workflow

**Story Curation**:
The human part of the **Story Workflow** in which a **Curator** reviews and edits a **Draft Story**, may change its **Draft Main Image**, and approves it as a **Story**.
_Avoid_: Review Workflow, approval workflow, manual workflow

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

**Draft Main Image**:
The current image selected for a **Draft Story** before approval. It becomes the **Main Image** only when the **Draft Story** becomes a **Story**.
_Avoid_: Proposed Main Image, selected image, temporary Main Image

**Main Image Candidate**:
A workflow-only image option from which **Draft Story Generation** or a **Curator** selects the **Draft Main Image**.
_Avoid_: Alternative, gallery image, image result

**Source**:
External cultural material used to ground or review a draft story.
_Avoid_: Source Material, claim reference, citation

**Visitor Experience**:
The public-facing experience that shows approved stories to visitors.
_Avoid_: Production output, AI output

## Relationships

- A **Geo Place** may become a **Point of Interest** when source data is cleaned for app use.
- A **Point of Interest** has exactly one **POI ID** and may retain optional external identifiers such as a Wikidata ID.
- A **Story Workflow** comprises **Draft Story Generation** followed by **Story Curation**.
- **Draft Story Generation** starts from an existing **Point of Interest** and creates or updates its current **Draft Story**.
- Manually regenerating **Story Prose** or **Main Image Candidates** belongs to **Draft Story Generation** because it recreates automated artifacts.
- Creating a **Point of Interest** from a **Geo Place** happens before, and does not belong to, the **Story Workflow**.
- **Story Curation** begins after **Draft Story Generation** has produced a reviewable **Draft Story**.
- A **Curator** selecting a **Main Image Candidate** as the **Draft Main Image** belongs to **Story Curation**.
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
- A **Draft Story** contains draft prose and one or more **Sources**, and may include zero or more editorial highlights, one **Draft Main Image**, and one or more **Main Image Candidates**.
- A **Draft Story** must include one **Draft Main Image** with source, rights, license, and attribution information before it becomes a **Story**.
- The first **Draft Story Generation** proposes up to three **Main Image Candidates** for each **Draft Story**.
- **Main Image Candidates** should help visitors recognize the **Point of Interest**, not inspect a detail.
- The first **Main Image Candidates** come from Wikimedia Commons.
- **Main Image Candidates** belong to the **Draft Story**, not to the visitor-facing **Story**.
- The first **Main Images** come from Wikimedia Commons.
- **Draft Story Generation** preserves the current **Draft Main Image** when it remains an available candidate; otherwise it automatically selects the first candidate with license and attribution information.
- A **Curator** may select a **Main Image Candidate** as the current **Draft Main Image**, and may change that selection before approving the **Draft Story**.
- **Main Image Candidates** and the **Draft Main Image** are reviewable parts of a **Draft Story**.
- When a **Curator** approves a **Draft Story**, its **Draft Main Image** becomes the **Main Image** of the resulting **Story**.
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

> **Dev:** "Does **Draft Story Generation** choose the final **Main Image**?"
> **Domain expert:** "It automatically selects a **Draft Main Image**. During **Story Curation**, a **Curator** may change it; it becomes the **Main Image** only when the **Draft Story** is approved as a **Story**."

## Flagged ambiguities

- "Raw POI" made a source-dataset place sound like it was already a **Point of Interest** in the app — resolved: call the source representation a **Geo Place**.
- "production workflow" was used to mean the internal AI-assisted editorial process — resolved: call this the **Story Workflow**.
- "Wikipedia-only source material" was used for the current first slice — resolved: first **Sources** may come from Wikipedia, Wikidata, and Wikimedia Commons, while implementation may begin with Wikipedia article text.
- "published POI content" implied a release destination — resolved: call the human-approved visitor-facing output a **Story**.
- "MDX narrative" was used for the story body — resolved: describe it as lightweight editorial formatting in **Story Prose** and keep MDX out of the product language.
- "AI Markdown" and "AI text" were used for the current reviewable artifact — resolved: call the domain object a **Draft Story**.
- "lead image candidate" over-specified the current image model because the draft workflow proposes only one image for now — resolved: call the image inside a story the **Main Image**.
- "alternatives" was used for images AI can propose to the curator — resolved: call these **Main Image Candidates**, and keep them out of the approved **Story**.
- "detail image" was considered for candidates — resolved: the first **Main Image Candidates** should all be recognizers for the **Point of Interest**.
- "image search" was ambiguous between Wikimedia Commons and broader web search — resolved: the first **Main Image Candidates** come from Wikimedia Commons only.
- "main image from Wikipedia" was ambiguous between using a Wikipedia article thumbnail as the source and discovering images through Wikipedia/Wikidata — resolved: Wikipedia/Wikidata may help discover images, but the image source and attribution should come from Wikimedia Commons.
- "exactly three candidates" overstated the first direct-source workflow because Wikidata and Wikipedia page images may provide fewer than three distinct usable images — resolved: the first **Story Workflow** proposes up to three **Main Image Candidates**.
- "show the selected image" was ambiguous between the **Story Workflow** and the **Visitor Experience** — resolved: the first image-candidate implementation stays workflow-only until the approved **Story** shape is explicit.
- "selected image" was ambiguous with final story approval — resolved: call the mutable selection on a **Draft Story** the **Draft Main Image**; it becomes the **Main Image** only upon approval.
- "manual refresh" was ambiguous between automated generation and human curation — resolved: regenerating **Story Prose** or **Main Image Candidates** belongs to **Draft Story Generation**, while selecting the **Draft Main Image** belongs to **Story Curation**.
