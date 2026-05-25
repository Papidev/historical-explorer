import { PoiRowsTable } from "./components/PoiRowsTable";
import {
  deleteAiText,
  generateTransformedPoiJson,
  refreshAiText,
  refreshWikiJson,
} from "./lib/actions";
import { defaultAiModel, loadInstalledAiModelOptions } from "./lib/aiModels";
import { loadPoiLists } from "./lib/loadPoiLists";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { rows, error } = await loadPoiLists();
  const aiModelOptions = await loadInstalledAiModelOptions();
  const configuredAiModel =
    process.env.AI_PROVIDER?.trim().toLowerCase() === "gemini"
      ? process.env.AI_MODEL
      : process.env.OLLAMA_MODEL;
  const initialAiModel =
    configuredAiModel && aiModelOptions.some((option) => option.value === configuredAiModel)
      ? configuredAiModel
      : (aiModelOptions.find((option) => option.value === defaultAiModel)?.value ??
        aiModelOptions[0]?.value ??
        "");

  return (
    <main className="flex h-screen min-h-screen flex-col bg-neutral-50 p-4 sm:p-6">
      <header className="mb-4 border-b border-black/10 pb-3">
        <h1 className="text-xl font-semibold text-black">POI Import</h1>
      </header>

      {error ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </section>
      ) : (
        <PoiRowsTable
          rows={rows}
          aiModelOptions={aiModelOptions}
          defaultAiModel={initialAiModel}
          generateTransformedAction={generateTransformedPoiJson}
          refreshWikiAction={refreshWikiJson}
          refreshAiAction={refreshAiText}
          deleteAiAction={deleteAiText}
        />
      )}
    </main>
  );
}
