import { personRepository } from "@/server/person/filesystemRepository";
import { toPublicPerson } from "@/server/person/types";
import { AdminDashboard } from "./components/AdminDashboard";
import {
  regeneratePerson,
  generateDraftStory,
  generateDraftStories,
  refreshStoryContent,
  refreshMainImageCandidates,
  refreshPoiTypes,
  resolveRelatedPeople,
  selectMainImageCandidate,
} from "./lib/actions";
import { getInitialAiSelection, loadAiModeOptions } from "./lib/aiModels";
import { loadPoiLists } from "./lib/loadPoiLists";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { rows, globalArtifacts, error } = await loadPoiLists();
  const aiModeOptions = await loadAiModeOptions();
  const initialAiSelection = await getInitialAiSelection();

  return (
    <AdminDashboard
      rows={rows}
      poiError={error}
      people={personRepository
        .list()
        .map((person) => ({
          ...toPublicPerson(person),
          linkedPois: rows
            .filter((row) =>
              row.storyContent?.relatedPeople.some(({ personId }) => personId === person.id),
            )
            .map((row) => ({
              id: row.id,
              name: row.transformedPoi?.name ?? row.rawPoi?.name ?? row.id,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "en")),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "en"))}
      regeneratePersonAction={regeneratePerson}
      globalArtifacts={globalArtifacts}
      aiModeOptions={aiModeOptions}
      initialAiSelection={initialAiSelection}
      generateDraftStoryAction={generateDraftStory}
      generateDraftStoriesAction={generateDraftStories}
      refreshStoryContentAction={refreshStoryContent}
      resolveRelatedPeopleAction={resolveRelatedPeople}
      refreshMainImageCandidatesAction={refreshMainImageCandidates}
      refreshPoiTypesAction={refreshPoiTypes}
      selectMainImageCandidateAction={selectMainImageCandidate}
    />
  );
}
