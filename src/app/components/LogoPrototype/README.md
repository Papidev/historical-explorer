# Mira logo prototype — round 2

Throwaway UI experiment on the existing homepage. Question: which identity gives Mira a warm, curious cultural character at both navigation and favicon sizes?

Run `pnpm dev`, then open `http://localhost:3000/?variant=A`. A/B/C switch using the floating controls or arrow keys. The normal homepage and production ignore the experiment.

## Decision — 30 October 2026

The user selected **C — The wanderer**, with two approved contextual palettes for now: the original black body and yellow wing on light backgrounds; a yellow body with anthracite wing and eye and darker golden legs on dark backgrounds. Use the explicit `tone` prop to match the actual background rather than the operating system theme. The wordmark follows the surrounding text color. The lettering and drawing remain unchanged. A is retained as an alternative; the original C must remain recoverable.

Before changing any colors, both references were frozen under `artifacts/logo-studies/daylight-v1/` and `artifacts/logo-studies/wanderer-v1/`, with standalone offline HTML, original React source, SVG symbol, original font and license, plus portable ZIP archives. Do not update these frozen references with later changes.

- **A — Daylight:** an editorial Fraunces wordmark with an irregular sun as a marginal note. Reference: [Smithsonian's use of light and knowledge](https://siarchives.si.edu/blog/design-archives-one-smithsonian).
- **B — City fragments:** an original modular tile symbol and Bricolage Grotesque wordmark. Reference: [Porto's narrative system](https://www.eduardoaires.com/projects/project/porto.html).
- **C — The wanderer:** an original city-bird drawing with a yellow wing, paired with Fraunces. References: [The Creative Independent's slow curiosity](https://thecreativeindependent.com/about/) and [Penguin's approachable illustrated identity](https://shop.penguin.co.uk/pages/about-us).

The first round was rejected: the rounded architectural silhouettes suggested tombstones; the yellow magnifying glass suggested detective stories. This round explores independent ideas rather than refining those shapes. References inform principles; their artwork is not reused.

Font files are unmodified copies from the Google Fonts repository, stored locally with their respective SIL Open Font Licenses:

- [Fraunces](https://github.com/google/fonts/tree/main/ofl/fraunces)
- [Bricolage Grotesque](https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque)

Once a direction is selected, record the verdict and preserve the prototype on a throwaway branch before integrating a properly finished logo.
