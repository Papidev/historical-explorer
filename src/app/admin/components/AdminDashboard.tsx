"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { PeopleTable } from "./PeopleTable";
import { useRef } from "react";
import type { AiModeOption, AiSelection } from "../lib/aiModels";
import type {
  AdminAction,
  AdminBatchAction,
  AdminArtifact,
  AdminPoiRow,
  AdminPerson,
} from "../lib/types";
import { AiGenerationSettings } from "./AiGenerationSettings";
import { PoiRowsTable } from "./PoiRowsTable";

export const AdminDashboard = ({
  rows,
  poiError,
  people,
  regeneratePersonAction,
  globalArtifacts,
  aiModeOptions,
  initialAiSelection,
  generateDraftStoryAction,
  generateDraftStoriesAction,
  refreshStoryContentAction,
  resolveRelatedPeopleAction,
  refreshMainImageCandidatesAction,
  refreshPoiTypesAction,
  selectMainImageCandidateAction,
}: {
  rows: AdminPoiRow[];
  poiError: string | null;
  people: AdminPerson[];
  regeneratePersonAction: AdminAction;
  globalArtifacts: AdminArtifact[];
  aiModeOptions: readonly AiModeOption[];
  initialAiSelection: AiSelection;
  generateDraftStoryAction: AdminAction;
  generateDraftStoriesAction: AdminBatchAction;
  refreshStoryContentAction: AdminAction;
  resolveRelatedPeopleAction: AdminAction;
  refreshMainImageCandidatesAction: AdminAction;
  refreshPoiTypesAction: AdminAction;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const aiSelectionRef = useRef(initialAiSelection);

  return (
    <main className="flex h-screen min-h-screen flex-col bg-neutral-50 p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-black">Content Admin</h1>
          <p className="mt-1 text-xs text-black/55">
            Generate and review Rome POI content and People.
          </p>
          <a
            href="/rome"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-violet-700 hover:underline"
          >
            Open Rome map
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
        <AiGenerationSettings
          aiModeOptions={aiModeOptions}
          initialAiSelection={initialAiSelection}
          selectionRef={aiSelectionRef}
        />
      </header>
      <TabGroup className="flex min-h-0 flex-1 flex-col">
        <TabList aria-label="Admin content" className="mb-4 flex gap-8 border-b border-gray-200">
          {["POIs", "People"].map((label) => (
            <Tab
              key={label}
              className="-mb-px flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-indigo-600 data-selected:border-indigo-600 data-selected:text-indigo-600"
            >
              {label}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                {label === "POIs" ? rows.length : people.length}
              </span>
            </Tab>
          ))}
        </TabList>
        <TabPanels className="flex min-h-0 flex-1 flex-col">
          <TabPanel unmount={false} className="flex min-h-0 flex-1 flex-col">
            {poiError ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              >
                {poiError}
              </p>
            ) : (
              <PoiRowsTable
                rows={rows}
                globalArtifacts={globalArtifacts}
                aiSelectionRef={aiSelectionRef}
                generateDraftStoryAction={generateDraftStoryAction}
                generateDraftStoriesAction={generateDraftStoriesAction}
                refreshStoryContentAction={refreshStoryContentAction}
                resolveRelatedPeopleAction={resolveRelatedPeopleAction}
                refreshMainImageCandidatesAction={refreshMainImageCandidatesAction}
                refreshPoiTypesAction={refreshPoiTypesAction}
                selectMainImageCandidateAction={selectMainImageCandidateAction}
              />
            )}
          </TabPanel>
          <TabPanel unmount={false} className="flex min-h-0 flex-1 flex-col">
            <PeopleTable
              people={people}
              aiSelectionRef={aiSelectionRef}
              regeneratePersonAction={regeneratePersonAction}
            />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </main>
  );
};
