# Throwaway POI gallery prototype

Question: which enlarged-image layout makes browsing a POI's gallery most natural from its Story drawer?

Run `pnpm prototype:gallery`, then open `/rome?variant=A` and select a published POI with images. If the dev server is already running, use it directly. Keep any existing `poiId` query parameter to compare the same POI across variants.

- `A`: light gallery view, large image, bottom thumbnail strip.
- `B`: light table, large image and a side list (bottom strip on small screens).
- `C`: horizontal photo sequence with native scrolling and snap points.

Click the drawer's main image to open the gallery. Buttons and left/right keys navigate photos; Escape closes the gallery and returns focus. A and B also accept horizontal swipes over the image. The floating purple bar changes the variant and updates the URL; outside the gallery, left/right keys change variants too. The current variant, image position, and total count expose the relevant UI state.

Uses the published detail gallery and original image URLs, with the existing attribution and license metadata. Local-only Stories do not supply this gallery. No persistence, new dependency, or production feature is introduced. The integration and switcher are disabled in production.

Prototype branch: `feat/poi-gallery-prototype`. User chose A with a light background instead of black. Preserve this branch as the design reference when a winner is implemented; remove the prototype integration, variants, switcher, and task script from the implementation branch. Validated direction: the layout of A, with a light background and dark controls; production implementation is still pending.
