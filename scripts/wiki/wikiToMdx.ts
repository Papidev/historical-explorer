const escapeMdxText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/</g, "\\<")
    .replace(/{/g, "\\{");

const toHeadingIfWikiSyntax = (line: string) => {
  const trimmed = line.trim();

  const level3 = trimmed.match(/^===\s*(.*?)\s*===$/);
  if (level3) {
    return `### ${escapeMdxText(level3[1])}`;
  }

  const level2 = trimmed.match(/^==\s*(.*?)\s*==$/);
  if (level2) {
    return `## ${escapeMdxText(level2[1])}`;
  }

  return null;
};

export const wikiTextToMdx = (content: string) => {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const output: string[] = [];

  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    output.push(escapeMdxText(paragraph.join(" ").replace(/\s+/g, " ").trim()));
    paragraph = [];
  };

  for (const rawLine of lines) {
    const heading = toHeadingIfWikiSyntax(rawLine);
    if (heading) {
      flushParagraph();
      output.push(heading);
      continue;
    }

    if (rawLine.trim().length === 0) {
      flushParagraph();
      continue;
    }

    paragraph.push(rawLine.trim());
  }

  flushParagraph();

  return `${output.join("\n\n")}\n`;
};
