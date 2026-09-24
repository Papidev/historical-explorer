import type { ReactNode } from "react";

export const CellFooter = ({
  children,
  updatedAt,
  generationDuration,
  updatedAtLabel = "Updated",
  generationDurationLabel = "Generated",
  relatedPeopleUpdatedAt,
  relatedPeopleGenerationDuration,
}: {
  children?: ReactNode;
  updatedAt?: string;
  generationDuration?: string;
  updatedAtLabel?: string;
  generationDurationLabel?: string;
  relatedPeopleUpdatedAt?: string;
  relatedPeopleGenerationDuration?: string;
}) =>
  updatedAt ||
  generationDuration ||
  relatedPeopleUpdatedAt ||
  relatedPeopleGenerationDuration ||
  children ? (
    <div className="mt-auto flex flex-col items-stretch gap-2 pt-3">
      <div className="min-w-0 text-[0.6875rem] leading-4 text-black/55">
        {updatedAt ? (
          <p className="truncate" title={`${updatedAtLabel}: ${updatedAt}`}>
            {updatedAtLabel}: <span className="font-bold">{updatedAt}</span>
          </p>
        ) : null}
        {generationDuration ? (
          <p className="truncate" title={`${generationDurationLabel}: ${generationDuration}`}>
            {generationDurationLabel}: <span className="font-bold">{generationDuration}</span>
          </p>
        ) : null}
        {relatedPeopleUpdatedAt ? (
          <p className="truncate" title={`People updated: ${relatedPeopleUpdatedAt}`}>
            People updated: <span className="font-bold">{relatedPeopleUpdatedAt}</span>
          </p>
        ) : null}
        {relatedPeopleGenerationDuration ? (
          <p className="truncate" title={`People generated: ${relatedPeopleGenerationDuration}`}>
            People generated: <span className="font-bold">{relatedPeopleGenerationDuration}</span>
          </p>
        ) : null}
      </div>
      {children ? <div className="self-end">{children}</div> : null}
    </div>
  ) : null;
