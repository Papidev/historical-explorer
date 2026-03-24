import { PoiColumn } from "./components/PoiColumn";
import { deleteSinglePoiJson, generateSinglePoiJson } from "./lib/actions";
import { loadPoiLists } from "./lib/loadPoiLists";

export const dynamic = "force-dynamic";

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
