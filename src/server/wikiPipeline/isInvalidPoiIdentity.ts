export const isInvalidPoiIdentity = (entity?: {
  claims?: {
    P31?: Array<{
      rank?: string;
      mainsnak?: { datavalue?: { value?: { id?: string } } };
    }>;
    P279?: Array<{ rank?: string; mainsnak?: { datavalue?: unknown } }>;
  };
}) =>
  (entity?.claims?.P31?.some(
    (claim) =>
      claim.rank !== "deprecated" &&
      ["Q13406463", "Q4167410", "Q4167836"].includes(claim.mainsnak?.datavalue?.value?.id ?? ""),
  ) ?? false) ||
  // A subclass is a kind of thing, not the individual place represented by a POI.
  (entity?.claims?.P279?.some(
    (claim) => claim.rank !== "deprecated" && claim.mainsnak?.datavalue !== undefined,
  ) ?? false);
