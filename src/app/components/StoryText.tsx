import type { ReactNode } from "react";

export const StoryText = ({ text, emphasis = [] }: { text: string; emphasis?: string[] }) => {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const { phrase, start } of emphasis
    .map((phrase) => ({ phrase, start: text.indexOf(phrase) }))
    .filter(({ phrase, start }) => phrase.length > 0 && start >= 0)
    .sort((left, right) => left.start - right.start || right.phrase.length - left.phrase.length)) {
    if (start < cursor) continue;
    parts.push(text.slice(cursor, start));
    parts.push(
      <strong key={start} className="font-semibold text-amber-900">
        {phrase}
      </strong>,
    );
    cursor = start + phrase.length;
  }

  parts.push(text.slice(cursor));
  return <>{parts}</>;
};
