import type { GenerationError } from "../../lib/types";

export const GenerationErrorDetails = ({
  errors,
  label = "Errors",
  latestOnly = false,
}: {
  errors: GenerationError[];
  label?: string;
  latestOnly?: boolean;
}) =>
  errors.length > 0 ? (
    <details className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-900">
      <summary className="cursor-pointer font-semibold">
        {latestOnly ? "Latest error" : `${label} (${errors.length}) · View details`}
      </summary>
      <ul className="mt-2 space-y-2">
        {(latestOnly ? errors.slice(0, 1) : errors).map((error, index) => (
          <li key={`${error.operation}-${error.at}-${index}`} className="break-words">
            <span className="font-semibold">
              {error.stage}
              {error.name ? ` · ${error.name}` : ""}
            </span>
            <span className="block text-red-800/75">
              {error.at} · {error.operation}
            </span>
            <span className="block">{error.message}</span>
          </li>
        ))}
      </ul>
    </details>
  ) : null;
