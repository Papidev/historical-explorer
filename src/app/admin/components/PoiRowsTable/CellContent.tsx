export const CellContent = ({
  title,
  subtitle,
  generationModel,
  isAvailable = false,
  titleTone = "status",
}: {
  title?: string;
  subtitle?: string;
  generationModel?: string;
  isAvailable?: boolean;
  titleTone?: "poi" | "status";
}) => (
  <div className="grid min-w-0 grid-rows-[1.5rem_1rem]">
    <div className="overflow-hidden">
      {title || !isAvailable ? (
        <p
          title={title}
          className={`truncate ${
            title
              ? titleTone === "poi"
                ? "text-base leading-5 font-semibold text-black"
                : "text-xs leading-4 font-semibold text-emerald-700"
              : "text-sm leading-5 text-black/35"
          }`}
        >
          {title ?? "Not generated"}
        </p>
      ) : null}
    </div>
    <div className="overflow-hidden">
      {subtitle ? (
        <p className="truncate font-mono text-xs leading-4 text-black/65" title={subtitle}>
          {subtitle}
        </p>
      ) : generationModel ? (
        <p className="truncate text-xs leading-4 text-black/55" title={`Model: ${generationModel}`}>
          Model: <span className="font-bold">{generationModel}</span>
        </p>
      ) : null}
    </div>
  </div>
);
