"use client";

import { AppVersion } from "@/app/components/ui/AppVersion";
import { MiraLogo } from "@/app/components/ui/MiraLogo";
import Link from "next/link";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { PeopleTable } from "./PeopleTable";
import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TypeMappings } from "./TypeMappings";
import type {
  TypeMappingCatalog,
  SaveTypeMapping,
  CategoryActions,
  ClassifyTypeMappings,
} from "@/types/PoiTypeMapping";
import type { AiModeOption, AiSelection } from "../lib/aiModels";
import type { AdminAction, AdminArtifact, AdminPoiRow, AdminPerson } from "../lib/types";
import { generateDraftStories } from "../lib/generateDraftStories";
import { AiGenerationSettings } from "./AiGenerationSettings";
import type { TablePage } from "../lib/tableQueries";
import { useTableNavigation } from "./useTableNavigation";
import { PoiRowsTable } from "./PoiRowsTable";

export const AdminDashboard = ({
  poiPage,
  generationRows,
  typeMappings,
  saveTypeMappingAction,
  classifyTypeMappingsAction,
  categoryActions,
  poiError,
  peoplePage,
  regeneratePersonAction,
  globalArtifacts,
  aiModeOptions,
  initialAiSelection,
  generateDraftStoryAction,
  refreshStoryContentAction,
  resolveRelatedPeopleAction,
  refreshMainImageCandidatesAction,
  refreshPoiTypesAction,
  selectMainImageCandidateAction,
}: {
  poiPage: TablePage<AdminPoiRow>;
  generationRows: AdminPoiRow[];
  typeMappings: TypeMappingCatalog;
  saveTypeMappingAction: SaveTypeMapping;
  classifyTypeMappingsAction: ClassifyTypeMappings;
  categoryActions: CategoryActions;
  poiError: string | null;
  peoplePage: TablePage<AdminPerson>;
  regeneratePersonAction: AdminAction;
  globalArtifacts: AdminArtifact[];
  aiModeOptions: readonly AiModeOption[];
  initialAiSelection: AiSelection;
  generateDraftStoryAction: AdminAction;
  refreshStoryContentAction: AdminAction;
  resolveRelatedPeopleAction: AdminAction;
  refreshMainImageCandidatesAction: AdminAction;
  refreshPoiTypesAction: AdminAction;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const router = useRouter();
  const poiNavigation = useTableNavigation(poiPage.query, "poi");
  const peopleNavigation = useTableNavigation(peoplePage.query, "people");
  const aiSelectionRef = useRef(initialAiSelection);
  const searchParams = useSearchParams();
  const unmappedTypes = typeMappings.types.filter((type) => type.categories === undefined).length;

  return (
    <main className="flex h-dvh flex-col bg-neutral-50 p-2 sm:p-3">
      <header className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href="/"
              aria-label="Mira home"
              className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
            >
              <MiraLogo size="small" />
            </Link>
            <h1 className="text-xl font-semibold text-black">Content Admin</h1>
            <AppVersion />
            <a
              href="/rome"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-violet-700 hover:underline"
            >
              Open Rome map
              <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <p className="mt-1 text-xs text-black/55">
            Generate and review Rome POI content and People.
          </p>
        </div>
        <AiGenerationSettings
          aiModeOptions={aiModeOptions}
          initialAiSelection={initialAiSelection}
          selectionRef={aiSelectionRef}
        />
      </header>
      <TabGroup
        selectedIndex={
          searchParams.get("section") === "type-mappings" ||
          searchParams.get("prototype") === "type-mappings"
            ? 2
            : searchParams.get("section") === "people"
              ? 1
              : 0
        }
        onChange={(index) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("section", ["pois", "people", "type-mappings"][index]);
          router.replace(`/admin?${params}`, { scroll: false });
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabList
          aria-label="Admin content"
          className="mb-2 flex shrink-0 gap-8 border-b border-gray-200"
        >
          {["POIs", "People", "Type mappings"].map((label) => (
            <Tab
              key={label}
              className="-mb-px flex cursor-pointer items-center gap-2 border-b-2 border-transparent px-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-indigo-600 data-selected:border-indigo-600 data-selected:text-indigo-600"
            >
              {label}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                {label === "POIs"
                  ? poiPage.total
                  : label === "People"
                    ? peoplePage.total
                    : typeMappings.types.length}
              </span>
              {label === "Type mappings" && unmappedTypes > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {unmappedTypes} unmapped
                </span>
              )}
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
                rows={poiPage.items}
                generationRows={generationRows}
                pagination={{ ...poiPage, query: poiNavigation.query }}
                onQueryChange={poiNavigation.update}
                isLoading={poiNavigation.isPending}
                globalArtifacts={globalArtifacts}
                aiSelectionRef={aiSelectionRef}
                generateDraftStoryAction={generateDraftStoryAction}
                generateDraftStoriesAction={async (formData) => {
                  const results = await generateDraftStories(formData);
                  router.refresh();
                  return results;
                }}
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
              people={peoplePage.items}
              pagination={{ ...peoplePage, query: peopleNavigation.query }}
              onQueryChange={peopleNavigation.update}
              isLoading={peopleNavigation.isPending}
              aiSelectionRef={aiSelectionRef}
              regeneratePersonAction={regeneratePersonAction}
            />
          </TabPanel>
          <TabPanel unmount={false} className="flex min-h-0 flex-1 flex-col">
            <TypeMappings
              catalog={typeMappings}
              saveRule={saveTypeMappingAction}
              categoryActions={categoryActions}
              classifyRules={classifyTypeMappingsAction}
              aiSelectionRef={aiSelectionRef}
            />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </main>
  );
};
