import type { AdminPoiListItem } from "@/utils/admin/poiImport";

type Props = {
  title: string;
  items: AdminPoiListItem[];
  emptyLabel?: string;
};

export const PoiListColumn = ({ title, items, emptyLabel = "No POIs available." }: Props) => (
  <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-black/10 bg-white">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-4 py-3">
      <h2 className="text-sm font-semibold text-black">{title}</h2>
      <span className="rounded bg-black/5 px-2 py-1 text-xs font-medium text-black/70">
        {items.length}
      </span>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-black/55">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-black/10">
          {items.map((item, index) => (
            <li key={`${item.source}-${item.id}-${index}`} className="px-4 py-3">
              <p className="text-sm font-medium text-black">{item.name}</p>
              <p className="mt-1 font-mono text-xs text-black/65">{item.id}</p>
              {item.wikidata ? <p className="mt-1 text-xs text-black/55">{item.wikidata}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  </section>
);
