import type { HistoryInsight, PublicStoryContent } from "@/server/storyWorkflow";
import { Topic } from "@/app/components/Topic/Topic";
import { StoryText } from "@/app/components/StoryText";
import { WikipediaLinks } from "@/app/components/WikipediaLinks";

const toOrdinal = (value: number) => {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`;
  }
  return `${value}${value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
};

const formatYearRange = (startYear: number, endYear?: number) => {
  if (endYear === undefined || endYear === startYear) {
    return `${Math.abs(startYear)} ${startYear < 0 ? "BC" : "AD"}`;
  }
  if (startYear < 0 && endYear < 0) {
    return `${Math.abs(startYear)}–${Math.abs(endYear)} BC`;
  }
  if (startYear > 0 && endYear > 0) {
    return `${startYear}–${endYear} AD`;
  }
  return `${Math.abs(startYear)} BC–${endYear} AD`;
};

const formatCenturyRange = (startYear: number, endYear: number) => {
  const startCentury = Math.ceil(Math.abs(startYear) / 100);
  const endCentury = Math.ceil(Math.abs(endYear) / 100);
  if (startYear < 0 === endYear < 0) {
    return `${toOrdinal(startCentury)}${
      startCentury === endCentury ? "" : `–${toOrdinal(endCentury)}`
    } century ${startYear < 0 ? "BC" : "AD"}`;
  }
  return `${toOrdinal(startCentury)} century BC–${toOrdinal(endCentury)} century AD`;
};

const formatHistoricalTime = (time: NonNullable<HistoryInsight["time"]>) =>
  `${time.precision === "approximate" ? "c. " : ""}${
    time.granularity === "century"
      ? formatCenturyRange(time.startYear, time.endYear ?? time.startYear)
      : formatYearRange(time.startYear, time.endYear)
  }`;

export const StoryContent = ({
  content,
  period,
  onOpenPerson,
}: {
  content: PublicStoryContent;
  period?: string;
  onOpenPerson?: (personId: string) => void;
}) => {
  const history = [...content.topics.history].sort((left, right) => {
    if (!left.time && !right.time) return 0;
    if (!left.time) return 1;
    if (!right.time) return -1;
    return left.time.startYear - right.time.startYear;
  });

  return (
    <div className="mt-4 space-y-6 text-base/7 text-zinc-800">
      {content.textFormat === "markdown" ? (
        <StoryText text={content.introduction} textFormat={content.textFormat} />
      ) : (
        <div className="space-y-4">
          {content.introduction
            .split(/\r?\n\s*\r?\n/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                <StoryText text={paragraph} emphasis={content.introductionEmphasis} />
              </p>
            ))}
        </div>
      )}
      {period ? (
        <dl className="grid gap-2 rounded-lg bg-amber-50 p-3 text-sm/6">
          <div>
            <dt className="font-semibold text-zinc-950">Period</dt>
            <dd>{period}</dd>
          </div>
        </dl>
      ) : null}
      {history.length > 0 ? (
        <section className="rounded-xl bg-orange-50/55 px-4 py-3 ring-1 ring-orange-950/5">
          <h3 className="text-xs/5 font-semibold tracking-[0.2em] text-zinc-950 uppercase">
            History
          </h3>
          <ul className="mt-3 list-disc space-y-3 pl-5 marker:text-orange-400">
            {history.map(({ description, time, emphasis }, index) => (
              <li key={`history-${index}`} className="pl-1">
                {time ? (
                  <p className="text-sm font-semibold text-orange-700">
                    {formatHistoricalTime(time)}
                  </p>
                ) : null}
                {content.textFormat === "markdown" ? (
                  <StoryText text={description} textFormat={content.textFormat} />
                ) : (
                  <p>
                    <StoryText text={description} emphasis={emphasis} />
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Topic
        title="Architecture"
        insights={content.topics.design.map(({ description, emphasis }, index) => (
          <StoryText
            key={index}
            text={description}
            emphasis={emphasis}
            textFormat={content.textFormat}
          />
        ))}
      />
      <Topic
        title="Art"
        insights={content.topics.art.map(({ description, emphasis }, index) => (
          <StoryText
            key={index}
            text={description}
            emphasis={emphasis}
            textFormat={content.textFormat}
          />
        ))}
      />
      {content.relatedPeople.length > 0 ? (
        <section className="rounded-xl bg-sky-50/55 px-4 py-3 ring-1 ring-sky-950/5">
          <h3 className="text-xs/5 font-semibold tracking-[0.2em] text-zinc-950 uppercase">
            Related People
          </h3>
          <ul className="mt-3 space-y-3">
            {content.relatedPeople.map(({ name, personId }, index) => (
              <li
                key={personId ?? `${name}-${index}`}
                className="relative pl-5 before:absolute before:top-0 before:left-1 before:text-sky-400 before:content-['•']"
              >
                {personId && onOpenPerson ? (
                  <button
                    type="button"
                    onClick={() => onOpenPerson(personId)}
                    className="cursor-pointer font-semibold text-sky-800 underline decoration-sky-300 underline-offset-4 hover:text-sky-950"
                  >
                    {name}
                  </button>
                ) : (
                  <span className="font-semibold text-zinc-950">{name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <WikipediaLinks sources={content.wikipediaSources} />
    </div>
  );
};
