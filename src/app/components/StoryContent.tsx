import type { HistoryInsight, PublicStoryContent } from "@/server/storyWorkflow";

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
    time.granularity === "century" && time.endYear !== undefined
      ? formatCenturyRange(time.startYear, time.endYear)
      : formatYearRange(time.startYear, time.endYear)
  }`;

const Topic = ({ title, insights }: { title: string; insights: string[] }) =>
  insights.length > 0 ? (
    <section>
      <h3 className="text-sm font-semibold tracking-wide text-zinc-950 uppercase">{title}</h3>
      <div className="mt-2 space-y-3">
        {insights.map((description, index) => (
          <p key={`${title}-${index}`}>{description}</p>
        ))}
      </div>
    </section>
  ) : null;

export const StoryContent = ({
  content,
  period,
  address,
}: {
  content: PublicStoryContent;
  period?: string;
  address?: string;
}) => {
  const history = [...content.topics.history].sort((left, right) => {
    if (!left.time && !right.time) return 0;
    if (!left.time) return 1;
    if (!right.time) return -1;
    return left.time.startYear - right.time.startYear;
  });

  return (
    <div className="mt-4 space-y-6 text-base leading-[1.7] text-zinc-800">
      <p>{content.introduction}</p>
      {period || address ? (
        <dl className="grid gap-2 rounded-lg bg-amber-50 p-3 text-sm">
          {period ? (
            <div>
              <dt className="font-semibold text-zinc-950">Period</dt>
              <dd>{period}</dd>
            </div>
          ) : null}
          {address ? (
            <div>
              <dt className="font-semibold text-zinc-950">Address</dt>
              <dd>{address}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {history.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold tracking-wide text-zinc-950 uppercase">History</h3>
          <div className="mt-2 space-y-3">
            {history.map(({ description, time }, index) => (
              <div key={`history-${index}`}>
                {time ? (
                  <p className="text-sm font-semibold text-orange-700">
                    {formatHistoricalTime(time)}
                  </p>
                ) : null}
                <p>{description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <Topic
        title="Design"
        insights={content.topics.design.map(({ description }) => description)}
      />
      <Topic title="Art" insights={content.topics.art.map(({ description }) => description)} />
      {content.relatedPeople.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold tracking-wide text-zinc-950 uppercase">
            Related People
          </h3>
          <dl className="mt-2 space-y-3">
            {content.relatedPeople.map(({ name, relationship }) => (
              <div key={name}>
                <dt className="font-semibold text-zinc-950">{name}</dt>
                <dd>{relationship}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
};
