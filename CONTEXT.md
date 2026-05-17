# Historical Explorer

Historical Explorer helps visitors understand cultural points of interest through concise, curated discoveries.

## Language

**Draft Workflow**:
The internal process that creates AI-assisted content proposals for human review.
_Avoid_: Production workflow

**Curator**:
The human decision-maker who reviews and accepts point of interest content.
_Avoid_: Editor, reviewer

**POI Draft**:
A reviewable AI-assisted content proposal for one point of interest.
_Avoid_: Partial draft, generated output

**POI Metadata**:
Basic identifying information for a point of interest, such as name, location, city, period, and short descriptor.
_Avoid_: Visitor narrative, curated content

**Approved POI Content**:
The visitor-facing content for one point of interest that has been accepted by a human curator.
_Avoid_: Published POI, Approved POI

**Visitor Narrative**:
The canonical concise visitor-facing prose for one point of interest.
_Avoid_: Article, summary, description

**Formatted Narrative Text**:
Visitor-facing prose that may include lightweight editorial formatting.
_Avoid_: MDX, rich content blocks

**Visitor Insight**:
A selected cultural idea that helps a visitor see, understand, connect, remember, or navigate a point of interest.
_Avoid_: Fact, section, card

**Lead Image Candidate**:
A proposed Wikimedia Commons primary image that helps visitors recognize a point of interest and includes enough attribution and rights information for review.
_Avoid_: Decoration, gallery image

**Source Material**:
The external cultural material used to support review of a point of interest draft.
_Avoid_: Claim references, citations

**Wikimedia Source Set**:
The first approved source family for point of interest drafts: Wikipedia, Wikidata, and Wikimedia Commons.
_Avoid_: Web sources, scraped sources

**Visitor Experience**:
The public-facing experience that shows only polished, approved content to visitors.
_Avoid_: Production output, AI output

## Relationships

- A **Draft Workflow** produces one **POI Draft** for a point of interest.
- A **POI Draft** contains one **Visitor Narrative**, zero or more editorial highlights, two to four **Lead Image Candidates**, and **Source Material**.
- A **Visitor Narrative** is written as **Formatted Narrative Text**.
- Editorial highlights are optional markup within a **Visitor Narrative**.
- A **Visitor Narrative** may make substantive claims only when they are supported by its **Source Material**.
- A **Visitor Narrative** is composed from the strongest few **Visitor Insights**, not from a complete article summary.
- A **Visitor Insight** should prefer visible details when they can carry the cultural meaning.
- The first **Source Material** comes from the **Wikimedia Source Set**.
- A **Curator** may edit a **POI Draft** before accepting it.
- Point of interest content may become **Approved POI Content** only when accepted by a **Curator**, regardless of whether it began as AI-generated or manually written content.
- **Approved POI Content** includes one accepted **Visitor Narrative** and exactly one accepted lead image.
- **POI Metadata** identifies a point of interest but is separate from **Approved POI Content**.
- The **Visitor Experience** shows **Approved POI Content**.
- The **Visitor Experience** may show **POI Metadata** when **Approved POI Content** is unavailable.

## Example dialogue

> **Dev:** "Can the **Draft Workflow** publish a generated narrative directly to the **Visitor Experience**?"
> **Domain expert:** "No — it can only propose content for human review."

## Flagged ambiguities

- "production workflow" was used to mean the internal AI-assisted editorial process — resolved: call this the **Draft Workflow**.
- "Wikipedia-only source material" was used for the current first slice — resolved: the product boundary is the **Wikimedia Source Set**, while implementation may begin with Wikipedia article text.
- "published POI content" implied a release destination — resolved: call the human-accepted visitor-facing output **Approved POI Content**.
- "rejected draft" was considered as a formal state — resolved: a **POI Draft** remains editable until it becomes **Approved POI Content**.
- "MDX narrative" was used for the narrative body — resolved: call this **Formatted Narrative Text** and keep MDX out of the product language.
