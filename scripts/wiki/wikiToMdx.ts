import wtf from "wtf_wikipedia";

const escapeMdxText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/</g, "\\<")
    .replace(/{/g, "\\{");

const escapeMdxUrl = (value: string) => value.replace(/ /g, "%20").replace(/\)/g, "%29");

const normalizeText = (value: string) => value.replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim();

const normalizeMdxLine = (value: string) => {
  const leadingWhitespace = value.match(/^\s*/)?.[0] ?? "";
  const content = value
    .slice(leadingWhitespace.length)
    .replace(/\(\s*\)/g, "")
    .replace(/[^\S\n]+/g, " ")
    .trim();

  return `${leadingWhitespace.replace(/\t/g, "  ")}${content}`.trimEnd();
};

const toHeading = (title: string, depth: number) => {
  const level = Math.max(2, Math.min(6, depth + 2));
  return `${"#".repeat(level)} ${escapeMdxText(title)}`;
};

const toPlainSectionBlocks = (text: string) => {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) {
    return [];
  }

  return cleaned
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
};

export const wikiTextToPlainText = (content: string) => {
  const doc = wtf(content);
  const sections = doc.sections();
  const output: string[] = [];

  for (const section of sections) {
    const title = section.title().trim();
    const lowerTitle = title.toLowerCase();

    if (lowerTitle === "external links") {
      continue;
    }

    if (title) {
      output.push(title);
    }

    for (const block of toPlainSectionBlocks(section.text({}))) {
      const paragraph = normalizeText(block);
      if (paragraph) {
        output.push(paragraph);
      }
    }
  }

  return `${output.join("\n\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
};

export const plainTextToMdx = (content: string) => {
  const output = toPlainSectionBlocks(content)
    .map((block) =>
      block
        .split("\n")
        .map((line) => escapeMdxText(normalizeMdxLine(line)))
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean);

  return `${output.join("\n\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
};

const toBulletItems = (block: string) => {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0 || !lines.every((line) => /^[*-]\s+/.test(line))) {
    return [];
  }

  return lines
    .map((line) => normalizeText(line.replace(/^[*-]\s+/, "")))
    .filter(Boolean)
    .map((line) => `- ${escapeMdxText(line)}`);
};

type LinkJson = {
  text?: string;
  type?: string;
  site?: string;
};

type SectionLike = {
  links: () => object | object[];
};

type LinkLike = {
  json: () => unknown;
};

const toExternalLinks = (section: SectionLike | null) => {
  if (!section) {
    return [];
  }

  const rawLinks = section.links();
  const linkObjects = (Array.isArray(rawLinks) ? rawLinks : [rawLinks]) as LinkLike[];

  const links = linkObjects
    .map((link) => link.json() as LinkJson)
    .filter((link) => link.type === "external" && typeof link.site === "string")
    .map((link) => {
      const href = link.site as string;
      const safeHref = escapeMdxUrl(href);
      const label = normalizeText(link.text ?? href);
      return `- [${escapeMdxText(label)}](${safeHref})`;
    });

  return Array.from(new Set(links));
};

export const wikiTextToMdx = (content: string) => {
  const doc = wtf(content);
  const sections = doc.sections();
  const output: string[] = [];

  for (const section of sections) {
    const title = section.title().trim();
    const lowerTitle = title.toLowerCase();
    const sectionOutput: string[] = [];

    if (lowerTitle === "external links") {
      const externalLinks = toExternalLinks(doc.section(title));
      if (externalLinks.length > 0) {
        sectionOutput.push(externalLinks.join("\n"));
      }
    } else {
      const blocks = toPlainSectionBlocks(section.text({}));
      for (const block of blocks) {
        const bullets = toBulletItems(block);
        if (bullets.length > 0) {
          sectionOutput.push(bullets.join("\n"));
          continue;
        }

        const paragraph = normalizeText(block);
        if (paragraph) {
          sectionOutput.push(escapeMdxText(paragraph));
        }
      }
    }

    if (sectionOutput.length === 0) {
      continue;
    }

    if (title) {
      output.push(toHeading(title, section.depth()));
    }

    output.push(...sectionOutput);
  }

  return `${output.join("\n\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
};
