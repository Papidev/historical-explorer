# mira-explorer

## 0.14.0

### Minor Changes

- Add authenticated online category catalog reads and creation with conflict checks coordinated with POI category saves.

## 0.13.3

### Patch Changes

- Introduce the Mira bird logo across the home, Rome map, admin, and browser icons, with light and dark palettes. Add restrained yellow accents and a prominent work-in-progress notice, and update the remaining atlas copy to Mira.

## 0.13.2

### Patch Changes

- Allow browsers to opt out of Web Analytics using the va-disable localStorage flag.

## 0.13.1

### Patch Changes

- Add Vercel Web Analytics to track page views across the application.

## 0.13.0

### Minor Changes

- Add authenticated POI category baselines and independent category saves with conflict detection and safe retries.

## 0.12.2

### Patch Changes

- Rename the public product branding and repository references to Mira.

## 0.12.1

### Patch Changes

- Prevent POI previews from flashing stale content when moving between map markers and from reattaching on repeated hover or focus. Replace the Arts & Culture palette with a paintbrush and make the Religion icon white for consistency.

## 0.12.0

### Minor Changes

- Open published POI images in a centered gallery with thumbnails, keyboard and swipe navigation, image credits, and explicit loading and retry states.

## 0.11.1

### Patch Changes

- Open category filters by default and use consistent sidebar typography. Retry intermittent SSL negotiation failures in public content reads and sanitize errors shared by concurrent requests.

## 0.11.0

### Minor Changes

- Show published online Stories, image galleries and linked People on the Rome map, retaining local-only POIs while using the complete online version for matching places. Cache online reads for up to 60 seconds and keep the homepage unchanged.

## 0.10.0

### Minor Changes

- Add Bearer-authenticated admin content APIs for catalog synchronization, Story and Person saves, and online version baselines, while preserving the existing visitor reads.

## 0.9.5

### Patch Changes

- Refresh the homepage Rome map screenshot with more visible places, an Ara Pacis preview, and the Castel Sant’Angelo detail drawer.

## 0.9.4

### Patch Changes

- Credit Wikipedia, Wikidata, and Wikimedia Commons on the homepage, explain AI's supporting role, and add Wikipedia's icon to Story links.

## 0.9.3

### Patch Changes

- Show a concise Story preview and a large Rome map on the homepage, and explain that visitors can explore further on Wikipedia.

## 0.9.2

### Patch Changes

- Group place filters into six parent categories with matching colors and solid icons in the sidebar and map markers, and improve subcategory spacing and selection visibility.

## 0.9.1

### Patch Changes

- Reject Wikimedia collections and generic concepts as POI sources, revalidate saved sources before resuming generation, and correct affected Rome content.

## 0.9.0

### Minor Changes

- Add name search for published places with keyboard-accessible suggestions and map navigation. Keep active filters unchanged when opening an excluded search result, and compact discovery headers and drawer close controls.

## 0.8.1

### Patch Changes

- Ignore local worktree backups and simplify worktree cleanup instructions.

## 0.8.0

### Minor Changes

- Paginate the admin POI and People tables on the server, preserving global search, POI filters and sorting, independent URL state, and automatic generation across the catalog.

## 0.7.0

### Minor Changes

- Add newest/oldest generation sorting to admin POIs, keep missing checkpoint dates from interrupting catalog loading, and show non-blocking Wikipedia source warnings as completion notes. Correct the Seven Spheres Mithraeum identity and save updated Rome Stories, People source contexts, and POI classifications.

## 0.6.6

### Patch Changes

- Fix map preview cleanup errors by rendering POI previews within the page's React tree.

## 0.6.5

### Patch Changes

- Simplify automatic Story generation with start/pause controls and no numeric limit. Finish the current POI before pausing, retain diagnostic logs, remove saved queue restoration, and compact the table toolbar and pagination footer.

## 0.6.4

### Patch Changes

- Polish the Rome header and discovery panel. Keep a single native MapLibre navigation control with a live numeric zoom level beside the Story drawer, and preserve the open Story when using map controls. Update the Porta San Giovanni Story.

## 0.6.3

### Patch Changes

- Add an All checkbox for admin status filters. Resolve ambiguous Related People by excluding non-human Wikidata candidates, show remaining identity candidates in errors, recognize confirmed Wikidata redirects when linking POIs, and retry temporary Ollama gateway failures.

## 0.6.2

### Patch Changes

- Add the Villa POI category and classify Domus Aurea as a villa.
- Keep non-blocking Wikipedia source warnings separate from generation errors and retry temporary Wikidata rate limits when acquiring POI types.
- Update generated Stories, People, and POI categories.

## 0.6.1

### Patch Changes

- Give the admin POI table more space with compact controls and an expanded view, and keep type mapping notifications at the bottom of the viewport.

## 0.6.0

### Minor Changes

- Add discreet Wikipedia links to Stories and People, with additional cited languages in a compact disclosure and every article opening in a new tab. Preserve source URLs in versioned content so links remain available in production without local Source snapshots.

## 0.5.2

### Patch Changes

- Highlight the selected POI in green while keeping map previews above markers and preserving native marker borders. Improve the filters panel with a compact fixed header, aligned category rows, and full-row accordion controls separate from checkbox selection.

## 0.5.1

### Patch Changes

- Prefer meaningful paragraph breaks in generated Story introductions and topic descriptions, and preserve newly generated Rome gate content and related People.

## 0.5.0

### Minor Changes

- Add Markdown formatting to Story introductions and topic descriptions, with spaced paragraphs, selective highlighted bold, italics, lists, and links. Preserve existing plain-text Stories and their emphasis metadata.

## 0.4.0

### Minor Changes

- Generate English Stories and People from complementary Wikipedia editions in English, Italian, French, German, and Spanish, selected using the countries of the POI and Person. Preserve source references and continue with available editions when others are missing. Retain only Related People named in the Story text, develop meaningful source-supported details, and rename the Design section to Architecture.

## 0.3.0

### Minor Changes

- Add optional, selectively chosen bold and warm-colored emphasis to Story introductions and topic items. Enrich three Rome reference Stories and update editorial guidance for descriptive, source-grounded content.

## 0.2.8

### Patch Changes

- Refine POI categories and manual type mappings for monuments, gardens, religious sites, and archaeological sites.

## 0.2.7

### Patch Changes

- Group religious sites under one category and identify them with yellow map markers and matching category filters.

## 0.2.6

### Patch Changes

- Share local Sources, acquired Types, generation checkpoints, progress, and diagnostic logs across checkouts through an external data directory, while keeping versioned content and public snapshots specific to each branch.

## 0.2.5

### Patch Changes

- Keep Type mappings in a single vertical scroll area, align rule actions to the right, and use accessible category action icons without horizontal overflow.

## 0.2.4

### Patch Changes

- Recover the Story queue after connection loss by checking server progress before continuing. Keep manual stops and Ollama usage-limit pauses manual, and allow category editing during long Story generations.

## 0.2.3

### Patch Changes

- Sort categories and subcategories alphabetically in the admin and category summaries.

## 0.2.2

### Patch Changes

- Show inherited parent categories in the admin type mappings list.

## 0.2.1

### Patch Changes

- Add generated Rome stories, selected images, and people, and update the POI catalog and category mappings.

## 0.2.0

### Minor Changes

- Add a collapsible category filter tree with an All categories checkbox, consistent parent selection states, a selection summary, alphabetical ordering, and a wider visitor filter drawer.

## 0.1.7

### Patch Changes

- Preserve saved POI categories during catalog regeneration when local Wikidata type files are unavailable.

## 0.1.6

### Patch Changes

- Fix automatic scrolling on the first opening of the Story queue dialog by attaching scroll observers when the content mounts.

## 0.1.5

### Patch Changes

- Validate Story Content, People, and image candidates before saving, preserving existing content when validation fails.

## 0.1.4

### Patch Changes

- Display the application version in the home footer and the Rome map and content admin headers.

- Validate saved People and Main Image Candidate files before using them, reporting malformed fields and inconsistent references with the affected file path.

## 0.1.3

### Patch Changes

- Expand Rome content with 110 generated stories, 339 related people, selected image metadata, and enriched POI categories.

## 0.1.2

### Patch Changes

- Update next from 16.3.5 to 16.3.8.

## 0.1.1

### Patch Changes

- Fix release tagging by disabling automatic package manager caching in the tag job.

## 0.1.0

### Initial tracked release

- Track application releases with a version, changelog, and Git tag. Expose the built version and commit at `/api/version`.
