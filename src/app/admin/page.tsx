import { readFileSync } from "node:fs";
import path from "node:path";
import { deleteSinglePoiJson, generateSinglePoiJson } from "./actions";
import { SubmitButton } from "./SubmitButton";

export const dynamic = "force-dynamic";

type GeoJsonFeature = {
  id?: string | number;
  properties?: Record<string, unknown>;
};

type GeoJson = {
  features?: GeoJsonFeature[];
};

type PoiItem = {
  id: string;
  name: string;
  wikidata?: string;
  featureIndex: number;
};

const parseGeoJson = (filePath: string) => {
  const raw = readFileSync(filePath, "utf-8");

  return JSON.parse(raw) as GeoJson;
};

const toPoiItems = (features: GeoJsonFeature[] | undefined) =>
  (features ?? []).map((feature, index) => {
    const properties = feature.properties ?? {};
    const id =
      (typeof feature.id === "string" && feature.id.trim()) ||
      (typeof feature.id === "number" ? `${feature.id}` : "") ||
      `missing-id-${index}`;
    const name = (typeof properties.name === "string" && properties.name.trim()) || id;
    const wikidata = typeof properties.wikidata === "string" ? properties.wikidata.trim() : undefined;

    return { id, name, wikidata, featureIndex: index } satisfies PoiItem;
  });

const loadPoiLists = () => {
  try {
    const rawPath = path.join(process.cwd(), "public", "data", "raw", "rome-pois-raw.geojson");
    const transformedPath = path.join(process.cwd(), "public", "data", "rome-pois.geojson");

    const rawPois = toPoiItems(parseGeoJson(rawPath).features);
    const transformedPois = toPoiItems(parseGeoJson(transformedPath).features);

    return { rawPois, transformedPois, error: null };
  } catch (error) {
    return {
      rawPois: [] as PoiItem[],
      transformedPois: [] as PoiItem[],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

const PoiColumn = ({
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

export default function AdminPage() {
  const { rawPois, transformedPois, error } = loadPoiLists();

  return (
    <main className="flex h-screen min-h-screen flex-col bg-neutral-50 p-4 sm:p-6">
      <header className="mb-4 border-b border-black/10 pb-3">
        <h1 className="text-xl font-semibold text-black">POI Import</h1>
      </header>

      {error ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</section>
      ) : (
        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <PoiColumn
            title="Raw POIs"
            items={rawPois}
            action={generateSinglePoiJson}
            actionFieldName="rawFeatureIndex"
            submitLabel="Generate JSON"
            pendingLabel="Generating..."
            submitTone="primary"
          />
          <PoiColumn
            title="Transformed POIs"
            items={transformedPois}
            action={deleteSinglePoiJson}
            actionFieldName="poiId"
            submitLabel="Delete"
            pendingLabel="Deleting..."
            submitTone="danger"
          />
        </section>
      )}
    </main>
  );
}
