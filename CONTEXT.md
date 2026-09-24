# Cultural Atlas

Cultural Atlas helps visitors understand cities through concise, curated discoveries across history, art, and culture.

**Cultural Atlas**:
The product name for the visitor experience and its editorial tools. The core perspectives are **History**, **Art**, and **Culture**.

## Language

**POI**:
An app-ready place or object on the map that may have metadata and a story.
_Avoid_: Clean POI, polished POI, transformed POI, spot, location, attraction

**Geo Place**:
The geographic representation of a place from a source dataset before irrelevant fields are removed and it becomes a **POI**.
_Avoid_: Raw POI, Raw Place, Raw Location, Raw feature, source feature

**POI ID**:
A stable, human-readable identifier assigned by Historical Explorer to a **POI**, independent of identifiers from external sources.
_Avoid_: Wikidata ID, content slug

**POI Type**:
A Wikidata classification assigned to a **POI**, identified by a Wikidata item and readable label. It is source data that may inform **POI Categories**.
_Avoid_: P31, category

**POI Category**:
An app-owned grouping used to filter **POIs** in the **Visitor Experience**. A **POI** may belong to several categories.
_Avoid_: POI Type, Wikidata category

**Story Workflow**:
The internal process that takes a **POI** through **Draft Story Generation** and **Story Curation** until it has an approved **Story**.
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
Basic identifying information for a **POI**, such as name, location, city, period, Wikidata ID, and short descriptor.
_Avoid_: Visitor narrative, curated content, story metadata

**Story**:
The approved source-grounded visitor-facing explanation for one **POI**, including **Story Content** and a main image.
_Avoid_: POI Story, Visitor Narrative, article, summary, description, AI text, Markdown

**Draft Story**:
A source-grounded visitor-facing story for one **POI** before curator approval.
_Avoid_: Draft POI Story, POI Draft, draft narrative, AI Markdown, AI text, Markdown, generated output

**Story Content**:
The structured, source-grounded content that supplies the **Visitor Experience**, composed of one **Story Introduction**, optional **Story Topics**, and **Related People**.
_Avoid_: Story body, Markdown, MDX, rendered page

**Story Introduction**:
The required plain-text opening of **Story Content** that gives the visitor a concise orientation to the **POI**.
_Avoid_: Summary, title, lead Markdown

**Story Topic**:
One of the supported cultural perspectives—currently history, design, or art—that groups related **Visitor Insights** in **Story Content**. These topics contribute to Cultural Atlas's broader focus on history, art, and culture. A topic may be empty when the **Sources** do not support it.
_Avoid_: Required section, content slot, card

**Visitor Insight**:
A selected idea that makes a **POI** worth noticing, understanding, connecting to, remembering, or navigating.
_Avoid_: Fact, section, card, reasoning

**Person**:
A historical, mythological, or imaginary individual represented once in Cultural Atlas, with an internal ID, external identity, source-grounded description, and optional curiosities, dates, and image.
_Avoid_: Person Profile, Cultural Figure, character, biography article

**Related Person**:
A **Person** referenced by name in a **Story** because the person is relevant to explaining its **POI**. The name may link to the canonical **Person**.
_Avoid_: Mention, character, unreferenced biography

**Unresolved Person Reference**:
A person reference found during **Draft Story Generation** whose identity cannot yet be matched safely to a **Person ID**.
_Avoid_: Person, guessed identity, duplicate Person

**Main Image**:
The image in a story that helps visitors recognize a **POI** or notice an important visible detail.
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

**Source Reference**:
An internal reference from a **Story Introduction**, **Visitor Insight**, or **Related Person** to a persisted **Source**. It supports curator review and is omitted from the default **Visitor Experience**.
_Avoid_: public footnote, URL embedded in prose, bibliography entry

**Visitor Experience**:
The public-facing experience that shows approved stories to visitors.
_Avoid_: Production output, AI output

## Relationships

- A **Geo Place** may become a **POI** when source data is cleaned for app use.
- A **POI** has exactly one **POI ID** and may retain optional external identifiers such as a Wikidata ID.
- A **POI** may have multiple **POI Types** from Wikidata and multiple app-owned **POI Categories**.
- A **Story Workflow** comprises **Draft Story Generation** followed by **Story Curation**.
- **Draft Story Generation** starts from an existing **POI** and creates or updates its current **Draft Story**.
- Manually regenerating **Story Content** or **Main Image Candidates** belongs to **Draft Story Generation** because it recreates automated artifacts.
- Creating a **POI** from a **Geo Place** happens before, and does not belong to, the **Story Workflow**.
- **Story Curation** begins after **Draft Story Generation** has produced a reviewable **Draft Story**.
- A **Curator** selecting a **Main Image Candidate** as the **Draft Main Image** belongs to **Story Curation**.
- A **Story** belongs to exactly one **POI**.
- A **POI** has at most one approved **Story** in the current product.
- A **POI** has at most one current **Draft Story**.
- A **Story** contains one **Story Content** and one **Main Image**.
- A **Story** may reference zero or more **Persons** as **Related Persons**.
- A **Person** has exactly one internal `id`, retains its Wikidata ID as external identity, and may be referenced by multiple **Stories**.
- A **Person** is canonical and reused wherever that identity appears.
- A **Person** may omit birth or death dates when they are unknown or do not apply.
- A **Person** may represent birth and death dates as exact or approximate.
- A **Person** requires a resolved identity, name, source-grounded description, and Sources; curiosities, dates, and its single image are optional.
- A **Person** includes a curiosity only when the Sources support it; unsupported curiosities are omitted.
- A **Person** has its own Sources, separate from the Sources of any **Story** that references it.
- The first **Person** content Source comes from Wikipedia; Wikidata supplies canonical identity, while Wikimedia Commons supplies image and rights metadata.
- A **Person** becomes available automatically after successful generation; the current slice does not add a separate approval state.
- Removing a **Related Person** from a **Story** removes only that reference; it does not remove the **Person**.
- **Draft Story Generation** preserves an ambiguous person reference as an **Unresolved Person Reference** rather than creating a guessed **Person**.
- A **Person** resolution failure does not discard otherwise valid **Story Content**; the name remains an **Unresolved Person Reference** that can be retried without regenerating the **Story Content**.
- The **Visitor Experience** may show an **Unresolved Person Reference** as a non-navigable name.
- The **Visitor Experience** links a resolved **Related Person** from a **Story** to that **Person** and shows an **Unresolved Person Reference** as a name without a link.
- The default **Visitor Experience** does not show **Person** Sources.
- A **Story** selects at most ten **Related Persons** that are significant to understanding its **POI** and orders them from most to least significant.
- **Story Content** contains plain text rather than Markdown or presentation styling.
- A **Draft Story** organizes its proposed **Visitor Insights** into the supported **Story Topics**.
- A **Story Topic** appears only when supported by the **Sources**; a **Draft Story** does not fill every available **Story Topic**.
- A **Story Topic** provides content semantics but does not own the React presentation used by the **Visitor Experience**.
- Dated **Visitor Insights** in the history **Story Topic** appear from oldest to newest; undated historical insights follow them.
- A **Story** may make substantive claims only when they are supported by its **Sources**.
- A **Story** retains the **Sources** and resolvable **Source References** used to support curator review.
- A **Story** is composed from the strongest few **Visitor Insights**, not from a complete article summary.
- A **Draft Story** proposes the **Visitor Insights** that may shape the approved **Story**.
- A **Draft Story** becomes a **Story** only when approved by a **Curator**.
- A **Draft Story** contains **Story Content** and one or more **Sources**, and may also include one **Draft Main Image** and one or more **Main Image Candidates**.
- A **Draft Story** must include one **Draft Main Image** with source, rights, license, and attribution information before it becomes a **Story**.
- The first **Draft Story Generation** proposes up to three **Main Image Candidates** for each **Draft Story**.
- **Main Image Candidates** should help visitors recognize the **POI**, not inspect a detail.
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
- **POI Metadata** identifies a **POI** but is separate from its **Story**.
- The **Visitor Experience** shows **Story** content.
- The default **Visitor Experience** does not show **Sources**.
- The default **Visitor Experience** does not show **Visitor Insights** directly.
- The **Visitor Experience** may show **POI Metadata** when a **Story** is unavailable.

## Example dialogue

> **Dev:** "Does **Draft Story Generation** choose the final **Main Image**?"
> **Domain expert:** "It automatically selects a **Draft Main Image**. During **Story Curation**, a **Curator** may change it; it becomes the **Main Image** only when the **Draft Story** is approved as a **Story**."
>
> **Dev:** "Must every **Draft Story** contain every **Story Topic**?"
> **Domain expert:** "No. It includes only **Story Topics** supported by the **Sources**, and their presentation is decided during **Story Curation**."

## Flagged ambiguities

- "Raw POI" made a source-dataset place sound like it was already a **POI** in the app — resolved: call the source representation a **Geo Place**.
- "production workflow" was used to mean the internal AI-assisted editorial process — resolved: call this the **Story Workflow**.
- "Wikipedia-only source material" was used for the current first slice — resolved: first **Sources** may come from Wikipedia, Wikidata, and Wikimedia Commons, while implementation may begin with Wikipedia article text.
- "published POI content" implied a release destination — resolved: call the human-approved visitor-facing output a **Story**.
- "MDX narrative" was considered as a future presentation mechanism — unresolved by design: **Story Content** is currently structured plain text, while MDX and configurable React renderers remain possible later increments.
- "AI Markdown" and "AI text" were used for the current reviewable artifact — resolved: call the domain object a **Draft Story**.
- "lead image candidate" over-specified the current image model because the draft workflow proposes only one image for now — resolved: call the image inside a story the **Main Image**.
- "alternatives" was used for images AI can propose to the curator — resolved: call these **Main Image Candidates**, and keep them out of the approved **Story**.
- "detail image" was considered for candidates — resolved: the first **Main Image Candidates** should all be recognizers for the **POI**.
- "image search" was ambiguous between Wikimedia Commons and broader web search — resolved: the first **Main Image Candidates** come from Wikimedia Commons only.
- "main image from Wikipedia" was ambiguous between using a Wikipedia article thumbnail as the source and discovering images through Wikipedia/Wikidata — resolved: Wikipedia/Wikidata may help discover images, but the image source and attribution should come from Wikimedia Commons.
- "exactly three candidates" overstated the first direct-source workflow because Wikidata and Wikipedia page images may provide fewer than three distinct usable images — resolved: the first **Story Workflow** proposes up to three **Main Image Candidates**.
- "show the selected image" was ambiguous between the **Story Workflow** and the **Visitor Experience** — resolved: the first image-candidate implementation stays workflow-only until the approved **Story** shape is explicit.
- "selected image" was ambiguous with final story approval — resolved: call the mutable selection on a **Draft Story** the **Draft Main Image**; it becomes the **Main Image** only upon approval.
- "manual refresh" was ambiguous between automated generation and human curation — resolved: regenerating **Story Content** or **Main Image Candidates** belongs to **Draft Story Generation**, while selecting the **Draft Main Image** belongs to **Story Curation**.
- "section" was ambiguous between generated cultural content and its public presentation — resolved: use optional **Story Topics** to organize proposed **Visitor Insights**, without requiring a corresponding section in the **Visitor Experience**.
