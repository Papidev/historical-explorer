"use client";

import { useRef } from "react";
import type { AiModeOption, AiSelection } from "../lib/aiModels";
import type { AdminAction, AdminArtifact, AdminPoiRow } from "../lib/types";
import { AiGenerationSettings } from "./AiGenerationSettings";
import { PoiRowsTable } from "./PoiRowsTable";

export const AdminDashboard = ({
  rows,
  globalArtifacts,
  aiModeOptions,
  initialAiSelection,
  generateDraftStoryAction,
  refreshStoryContentAction,
  resolveRelatedPeopleAction,
  refreshMainImageCandidatesAction,
  selectMainImageCandidateAction,
}: {
  rows: AdminPoiRow[];
  globalArtifacts: AdminArtifact[];
  aiModeOptions: readonly AiModeOption[];
  initialAiSelection: AiSelection;
  generateDraftStoryAction: AdminAction;
  refreshStoryContentAction: AdminAction;
  resolveRelatedPeopleAction: AdminAction;
  refreshMainImageCandidatesAction: AdminAction;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const aiSelectionRef = useRef(initialAiSelection);

  return (
    <main className="flex h-screen min-h-screen flex-col bg-neutral-50 p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-black">POI Import</h1>
          <p className="mt-1 text-xs text-black/55">
            Generate and review Rome POI content from raw source data.
          </p>
        </div>
        <AiGenerationSettings
          aiModeOptions={aiModeOptions}
          initialAiSelection={initialAiSelection}
          selectionRef={aiSelectionRef}
        />
      </header>
      <PoiRowsTable
        rows={rows}
        globalArtifacts={globalArtifacts}
        aiSelectionRef={aiSelectionRef}
        generateDraftStoryAction={generateDraftStoryAction}
        refreshStoryContentAction={refreshStoryContentAction}
        resolveRelatedPeopleAction={resolveRelatedPeopleAction}
        refreshMainImageCandidatesAction={refreshMainImageCandidatesAction}
        selectMainImageCandidateAction={selectMainImageCandidateAction}
      />
    </main>
  );
};
