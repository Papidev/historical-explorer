import { notFound } from "next/navigation";
import { personRepository } from "@/server/person/filesystemRepository";
import { toPublicPerson } from "@/server/person/types";
import { AdminDashboard } from "./components/AdminDashboard";
import {
  saveTypeMapping,
  classifyTypeMappings,
  savePoiCategory,
  movePoiCategory,
  deletePoiCategory,
  regeneratePerson,
  generateDraftStory,
  refreshStoryContent,
  refreshMainImageCandidates,
  refreshPoiTypes,
  resolveRelatedPeople,
  selectMainImageCandidate,
} from "./lib/actions";
import { getInitialAiSelection, loadAiModeOptions } from "./lib/aiModels";
import { loadPoiLists } from "./lib/loadPoiLists";
import { getPoiTablePage, getPeopleTablePage, readTableQuery } from "./lib/tableQueries";

import { createPoiTypeMappings } from "@/server/poiTypeMappings";

export const dynamic = "force-dynamic";

const AdminPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  if (process.env.NODE_ENV === "production") notFound();

  const { rows, globalArtifacts, error } = await loadPoiLists();
  const params = await searchParams;
  const aiModeOptions = await loadAiModeOptions();
  const initialAiSelection = await getInitialAiSelection();

  const people = personRepository
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
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return (
    <AdminDashboard
      poiPage={getPoiTablePage(rows, readTableQuery(params, "poi"))}
      generationRows={rows
        .filter((row) => row.rawPoi && !row.storyContent)
        .map(({ id, rawPoi }) => ({ id, rawPoi }))}
      typeMappings={createPoiTypeMappings().getCatalog()}
      saveTypeMappingAction={saveTypeMapping}
      classifyTypeMappingsAction={classifyTypeMappings}
      categoryActions={{ save: savePoiCategory, delete: deletePoiCategory, move: movePoiCategory }}
      poiError={error}
      peoplePage={getPeopleTablePage(people, readTableQuery(params, "people"))}
      regeneratePersonAction={regeneratePerson}
      globalArtifacts={globalArtifacts}
      aiModeOptions={aiModeOptions}
      initialAiSelection={initialAiSelection}
      generateDraftStoryAction={generateDraftStory}
      refreshStoryContentAction={refreshStoryContent}
      resolveRelatedPeopleAction={resolveRelatedPeople}
      refreshMainImageCandidatesAction={refreshMainImageCandidates}
      refreshPoiTypesAction={refreshPoiTypes}
      selectMainImageCandidateAction={selectMainImageCandidate}
    />
  );
};

export default AdminPage;
