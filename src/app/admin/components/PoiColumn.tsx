import type { PoiItem } from "../lib/types";
import { SubmitButton } from "./SubmitButton";

export const PoiColumn = ({
  title,
  items,
  action,
  actionFieldName,
  submitLabel,
  pendingLabel,
  submitTone,
}: {
  title: string;
  items: PoiItem[];
  action?: (formData: FormData) => Promise<void>;
  actionFieldName?: "rawFeatureIndex" | "poiId";
  submitLabel?: string;
  pendingLabel?: string;
  submitTone?: "primary" | "danger";
}) => (
  <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-black/10 bg-white">
    <header className="border-b border-black/10 px-4 py-3">
      <h2 className="text-sm font-semibold text-black">{title}</h2>
      <p className="mt-1 text-xs text-black/60">{items.length} items</p>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-black/55">No POIs available.</p>
      ) : (
        <ul className="divide-y divide-black/10">
          {items.map((item, index) => (
            <li key={`${item.id}-${index}`} className="px-4 py-3">
              <p className="text-sm font-medium text-black">{item.name}</p>
              <p className="mt-1 font-mono text-xs text-black/65">{item.id}</p>
              {item.wikidata ? <p className="mt-1 text-xs text-black/55">{item.wikidata}</p> : null}
              {action && actionFieldName && submitLabel && pendingLabel ? (
                <form action={action}>
                  <input
                    type="hidden"
                    name={actionFieldName}
                    value={actionFieldName === "rawFeatureIndex" ? item.featureIndex : item.id}
                  />
                  <SubmitButton idleLabel={submitLabel} pendingLabel={pendingLabel} tone={submitTone} />
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  </section>
);
