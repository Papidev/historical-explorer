import wtf from "wtf_wikipedia";

const normalizeText = (value: string) =>
  value
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

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

  return `${output
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
};
