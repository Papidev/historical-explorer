export const getPoiDisplayName = (
  name: string,
  sources: Array<{ title: string; url: string }> = [],
) => {
  for (const language of ["en", "it"]) {
    const title = sources
      .find(
        (source) =>
          URL.parse(source.url)?.hostname === `${language}.wikipedia.org` && source.title.trim(),
      )
      ?.title.trim();
    if (title) return title;
  }
  return name;
};
