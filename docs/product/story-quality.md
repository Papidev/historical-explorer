# Story quality references

These working references turn the [product vision](vision.md) into concrete
editorial examples. They follow the [Rome Story audit in #116](https://github.com/Papidev/historical-explorer/issues/116).

On 14 October 2026 the product owner selected all three examples below and
clarified the goal: describe the place and its interesting features, including
independent details, without organizing every Story around one central idea.
The owner also asked for richer introductions as a general criterion for every
Story, demonstrated here in the three references; rewriting the rest of the
existing catalog is outside this task.
The revised texts and checklist remain subject to the review in
[#117](https://github.com/Papidev/historical-explorer/issues/117).

## Review checklist

- **Accuracy and uncertainty:** every claim has a supporting saved Source
  Reference. Check suspicious dates, translations, identities, and inherited
  Source errors. Preserve uncertainty and distinguish tradition from established
  history; omit an unresolved claim when it adds little.
- **Place and interesting features:** give the introduction a developed,
  self-contained description of what and where the place is, its spaces or
  structure, and the interesting features or objects it contains. A reader
  should gain a substantial first understanding of the place. Apply this to
  every Story with depth supported by its Sources, without a fixed length.
  Include interesting details about its history, architecture, art,
  collections, and other cultural features on their own merits. They may connect,
  but do not need to support one theme or a central argument. Give context when
  useful; do not invent an interpretation to justify including a detail.
- **Useful depth:** select history and other details for their interest and
  relevance to the place, rather than their fit with a narrative theme. A date must
  belong to the event described, with appropriate precision. Do not substitute a
  person's lifespan or papacy. Leave unsupported topics empty; there is no word,
  item, or Related People target.
- **Readable English:** use clear contemporary language without promotional
  praise, unexplained specialist terms, duplicated facts, or assumptions that
  the reader is physically present. Group related information so each item is
  easy to follow; independent details can remain independent. Prefer a paragraph
  break after a sentence when a distinct idea, shift of focus, or useful reading
  pause warrants it. Keep closely connected sentences together. This applies to
  introductions and topic descriptions as an editorial preference, not a rule
  for every period; abbreviations and decimal numbers do not mark sentence ends.
- **Meaningful connections:** retain individuals significant to this Story,
  linked to saved Person records. A list of everyone mentioned in a Source is
  not a useful selection. Families and institutions are not individual People.
- **Selective emphasis:** an introduction or topic item may identify short
  phrases to display in bold with a restrained color, only when they help
  recognition, orientation, or scanning for an interesting detail. Paragraphs
  and entire Stories may have none. Do not automatically emphasize names,
  dates, first words, or generic terms, and do not invent a quota.
- **Presentation:** check the actual Story panel on narrow and wide screens.
  Dates, section order, and image crops must support the meaning. The Main Image
  should help recognize the place or notice a meaningful detail, with its source,
  rights, license, and attribution available. Keep Editorial Notes out of the
  visitor text.

## Working references

| Story                                                                                                 | Features covered                                                                                   | What the revision demonstrates                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [Centrale Montemartini](../../data/rome/stories/centrale-montemartini/story.json)                     | Former power station, machinery, sculpture, sarcophagi, exterior lamps, and papal train carriages. | Describe the museum and include different worthwhile features without making every item explain the machinery/sculpture contrast.        |
| [Casal Rotondo](../../data/rome/stories/casal-rotondo/story.json)                                     | Ancient tomb, circular structure, farmhouse, lookout use, and nearby fragments.                    | Keep a small Source-supported description, preserve uncertainty, and omit the erroneous date and unverified reconstruction.              |
| [Santa Maria in Trastevere](../../data/rome/stories/basilica-di-santa-maria-in-trastevere/story.json) | Early history, columns, façade and tower, mosaics, icon, ceiling, and Avila Chapel.                | Cover independent artistic and architectural details, with clear locations and qualified claims, without requiring one organizing theme. |

These are content examples, not a fixed template or a requirement to give every
place the same depth. The Source References in their JSON remain `wikipedia`;
the saved Source locations and hashes are recorded in
[#113](https://github.com/Papidev/historical-explorer/issues/113).

## Evidence and deliberate omissions

- **Centrale Montemartini:** the saved Source's history supports municipal power
  generation, the river/transport location, and the temporary display that became
  a museum. Its collections section supports the machinery/sculpture relationship,
  Cambellotti's lamps, the sarcophagi, and the papal train carriages. The revision omits the disputed closure year and does
  not equate the exhibition's 1997 opening with the date it became permanent.
  The [museum's account of the plant](https://www.centralemontemartini.org/it/node/1000404)
  is an additional editorial check, not a replacement saved Source.
- **Casal Rotondo:** the saved Source supports approximate construction, later
  reuse, the circular structure, Canina's display wall, and the disputed
  inscription. The revision omits the erroneous century of Canina's work and the
  unverified roof/frieze reconstruction. The
  [Appia park's account](https://www.parcoarcheologicoappiaantica.it/luoghi/via-appia-antica/mausoleo-di-casal-rotondo/)
  independently explains why the fragments do not identify the monumental tomb.
- **Santa Maria:** the saved Source's History and Interior sections support the
  rebuilding, foundation tradition, columns, façade, tower, Avila Chapel,
  mosaics, ceiling, and early icon. Column provenance is qualified, consistent with
  [Turismo Roma's account](https://www.turismoroma.it/it/luoghi/basilica-di-santa-maria-trastevere).
  The disputed exterior mosaic attribution and unrelated recent events are
  omitted. Gherardi is named in the retained chapel description; no new Person
  was generated merely to add a link.

## Limits and use for remaining launch Stories

The existing history/design/art structure is retained. Generation guidance now
supports the descriptive introduction and optional, selective emphasis.
Publication rules and Person descriptions are unchanged. Reviewers should
use the checklist and references to select corrections for the remaining launch
Stories; neither a second AI pass nor a matching Source ID establishes accuracy.

Existing image choices are retained for comparison. Missing visible Main Image
credits, portrait-image crops, and century-date presentation problems identified
in #116 still need follow-up. They are not accepted as launch-ready behaviour
by adopting a content reference. The selected references avoid misleading
century labels rather than changing the renderer in this editorial task.

Approval of the revised text, the checklist, and any further acceptable
limitations remains part of #117. These examples do not certify the rest of the
catalog or provide a comprehensive independent fact-check of their Sources.

## Emphasis in saved content

New Story Content uses `textFormat: "markdown"`: introductions and topic
descriptions separate paragraphs with blank lines and use `**bold**` directly
for selective emphasis. React applies the same restrained color to bold text.

Existing plain-text Stories may carry an optional `emphasis` array of exact,
case-sensitive phrases from their own text. An omitted or empty array means
no emphasis. Validation rejects phrases absent from the block. The plain-text
renderer emphasizes the first occurrence of each selected phrase and avoids
overlapping selections. Existing Stories require no migration.
