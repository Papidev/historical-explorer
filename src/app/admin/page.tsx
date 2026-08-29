import { AdminDashboard } from "./components/AdminDashboard";
import {
  deleteAiText,
  deleteStoryContent,
  deleteMainImageCandidates,
  generateDraftStory,
  refreshAiText,
  refreshStoryContent,
  refreshMainImageCandidates,
  resetDraftStory,
  selectMainImageCandidate,
} from "./lib/actions";
import { getInitialAiSelection, loadAiModeOptions } from "./lib/aiModels";
import { loadPoiLists } from "./lib/loadPoiLists";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { rows, error } = await loadPoiLists();
  const aiModeOptions = await loadAiModeOptions();
  const initialAiSelection = await getInitialAiSelection();

  return (
    <>
      {error ? (
        <main className="flex h-screen min-h-screen flex-col bg-neutral-50 p-4 sm:p-6">
          <header className="mb-4 border-b border-black/10 pb-3">
            <h1 className="text-xl font-semibold text-black">POI Import</h1>
          </header>
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </section>
        </main>
      ) : (
        <AdminDashboard
          rows={rows}
          aiModeOptions={aiModeOptions}
          initialAiSelection={initialAiSelection}
          generateDraftStoryAction={generateDraftStory}
          resetDraftStoryAction={resetDraftStory}
          refreshAiAction={refreshAiText}
          deleteAiAction={deleteAiText}
          refreshStoryContentAction={refreshStoryContent}
          deleteStoryContentAction={deleteStoryContent}
          refreshMainImageCandidatesAction={refreshMainImageCandidates}
          deleteMainImageCandidatesAction={deleteMainImageCandidates}
          selectMainImageCandidateAction={selectMainImageCandidate}
        />
      )}
    </>
  );
}
