const escapeMdxText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/</g, "\\<")
    .replace(/{/g, "\\{");

const escapeMdxUrl = (value: string) => value.replace(/ /g, "%20").replace(/\)/g, "%29");

const SKIPPED_LEVEL2_SECTIONS = new Set(["references", "see also"]);

const normalizeWikiInline = (value: string) => {
  const withoutExternalLinks = value
    .replace(/\[((?:https?:)?\/\/[^\s\]]+)\s+([^\]]+)\]/g, "$2")
    .replace(/\[((?:https?:)?\/\/[^\s\]]+)\]/g, "$1");

  const withInternalLinks = withoutExternalLinks
    .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1");

  const withoutTemplateTokens = withInternalLinks.replace(/\{\{[^{}]*\}\}/g, "");
  const withoutReferences = withoutTemplateTokens
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");

  const withoutEmphasisMarkers = withoutReferences
    .replace(/'''(.*?)'''/g, "$1")
    .replace(/''(.*?)''/g, "$1");

  return withoutEmphasisMarkers.replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim();
};

const toHeadingIfWikiSyntax = (line: string) => {
  const trimmed = line.trim();

  const level3 = trimmed.match(/^===\s*(.*?)\s*===$/);
  if (level3) {
    return { level: 3 as const, title: level3[1].trim(), mdx: `### ${escapeMdxText(level3[1])}` };
  }

  const level2 = trimmed.match(/^==\s*(.*?)\s*==$/);
  if (level2) {
    return { level: 2 as const, title: level2[1].trim(), mdx: `## ${escapeMdxText(level2[1])}` };
  }

  return null;
};

const toExternalLinkMdx = (value: string) => {
  const withLabel = value.match(/^\[((?:https?:)?\/\/[^\s\]]+)\s+([^\]]+)\]$/i);
  if (withLabel) {
    const href = withLabel[1].startsWith("//") ? `https:${withLabel[1]}` : withLabel[1];
    const safeHref = escapeMdxUrl(href);
    const label = escapeMdxText(withLabel[2].trim());
    return `[${label}](${safeHref})`;
  }

  const bare = value.match(/^\[((?:https?:)?\/\/[^\s\]]+)\]$/i);
  if (bare) {
    const href = bare[1].startsWith("//") ? `https:${bare[1]}` : bare[1];
    const safeHref = escapeMdxUrl(href);
    const label = escapeMdxText(href);
    return `[${label}](${safeHref})`;
  }

  return null;
};

export const wikiTextToMdx = (content: string) => {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const output: string[] = [];
  let currentLevel2Heading = "";
  let templateBlockDepth = 0;
  let skipCurrentLevel2Section = false;

  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    output.push(escapeMdxText(paragraph.join(" ").replace(/\s+/g, " ").trim()));
    paragraph = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const templateOpenCount = (rawLine.match(/\{\{/g) ?? []).length;
    const templateCloseCount = (rawLine.match(/\}\}/g) ?? []).length;

    if (templateBlockDepth > 0) {
      templateBlockDepth = Math.max(0, templateBlockDepth + templateOpenCount - templateCloseCount);
      continue;
    }

    // Skip top-level templates (infobox/navbox/single-line template directives).
    if (trimmed.startsWith("{{")) {
      if (templateOpenCount > templateCloseCount) {
        templateBlockDepth = Math.max(0, templateOpenCount - templateCloseCount);
      }
      continue;
    }

    if (
      trimmed.length === 0 ||
      trimmed.startsWith("__") ||
      trimmed.startsWith("[[Category:") ||
      trimmed.startsWith("[[File:") ||
      trimmed.startsWith("<!--")
    ) {
      flushParagraph();
      continue;
    }

    const heading = toHeadingIfWikiSyntax(rawLine);
    if (heading) {
      flushParagraph();
      if (heading.level === 2) {
        currentLevel2Heading = heading.title.toLowerCase();
        skipCurrentLevel2Section = SKIPPED_LEVEL2_SECTIONS.has(currentLevel2Heading);
      }
      if (!skipCurrentLevel2Section) {
        output.push(heading.mdx);
      }
      continue;
    }

    if (skipCurrentLevel2Section) {
      continue;
    }

    if (trimmed.startsWith("*")) {
      flushParagraph();
      const listValue = trimmed.replace(/^\*\s*/, "");
      if (currentLevel2Heading === "external links") {
        const externalLinkMdx = toExternalLinkMdx(listValue);
        if (externalLinkMdx) {
          output.push(`- ${externalLinkMdx}`);
          continue;
        }
      }

      const itemText = normalizeWikiInline(listValue);
      if (itemText) {
        output.push(`- ${escapeMdxText(itemText)}`);
      }
      continue;
    }

    const normalizedLine = normalizeWikiInline(trimmed);
    if (normalizedLine) {
      paragraph.push(normalizedLine);
    }
  }

  flushParagraph();

  const mdx = `${output.join("\n\n")}\n`
    .replace(/\n##\s*(References|See also)\s*\n/gi, "\n")
    .replace(/^\s*-\s*$/gm, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\n{3,}/g, "\n\n");

  return mdx;
};
