"use client";

import { useState } from "react";
import { ListboxSelect } from "@/app/components/ui/ListboxSelect";
import { Toggle } from "@/app/components/ui/Toggle";
import type { AiMode, AiModeOption, AiSelection } from "../lib/aiModels";
import type { AdminAction, AdminPoiRow } from "../lib/types";
import { PoiRowsTable } from "./PoiRowsTable";

const getModeOption = (aiModeOptions: readonly AiModeOption[], mode: AiMode) =>
  aiModeOptions.find((option) => option.mode === mode) ?? aiModeOptions[0];

export const AdminDashboard = ({
  rows,
  aiModeOptions,
  initialAiSelection,
  generateDraftStoryAction,
  resetDraftStoryAction,
  refreshStoryContentAction,
  resolveRelatedPeopleAction,
  deleteStoryContentAction,
  refreshMainImageCandidatesAction,
  deleteMainImageCandidatesAction,
  selectMainImageCandidateAction,
}: {
  rows: AdminPoiRow[];
  aiModeOptions: readonly AiModeOption[];
  initialAiSelection: AiSelection;
  generateDraftStoryAction: AdminAction;
  resetDraftStoryAction: AdminAction;
  refreshStoryContentAction: AdminAction;
  resolveRelatedPeopleAction: AdminAction;
  deleteStoryContentAction: AdminAction;
  refreshMainImageCandidatesAction: AdminAction;
  deleteMainImageCandidatesAction: AdminAction;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const [selectedAiMode, setSelectedAiMode] = useState(initialAiSelection.mode);
  const [selectedAiModelByMode, setSelectedAiModelByMode] = useState<Record<AiMode, string>>({
    local:
      initialAiSelection.mode === "local"
        ? initialAiSelection.model
        : (getModeOption(aiModeOptions, "local").defaultModel ?? ""),
    cloud:
      initialAiSelection.mode === "cloud"
        ? initialAiSelection.model
        : (getModeOption(aiModeOptions, "cloud").defaultModel ?? ""),
  });
  const selectedModeOption = getModeOption(aiModeOptions, selectedAiMode);
  const selectedAiModel = selectedAiModelByMode[selectedAiMode] || selectedModeOption.defaultModel;

  return (
    <main className="flex h-screen min-h-screen flex-col bg-neutral-50 p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-black">POI Import</h1>
          <p className="mt-1 text-xs text-black/55">
            Generate and review Rome POI content from raw source data.
          </p>
        </div>
        <fieldset className="rounded-lg border border-black/10 bg-white px-3 pb-3 shadow-xs">
          <legend className="px-1 text-xs font-semibold tracking-wide text-black/55 uppercase">
            AI generation
          </legend>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <Toggle
              checked={selectedAiMode === "cloud"}
              description={`(${selectedModeOption.providerLabel}, ${
                selectedAiMode === "cloud" ? "paid" : "free"
              })`}
              id="cloud-mode"
              label="Cloud mode"
              name="cloud-mode"
              onChange={(checked) => setSelectedAiMode(checked ? "cloud" : "local")}
            />
            <div className="min-w-72">
              <ListboxSelect
                label="Model"
                value={selectedAiModel}
                onChange={(value) =>
                  setSelectedAiModelByMode({
                    ...selectedAiModelByMode,
                    [selectedAiMode]: value,
                  })
                }
                options={selectedModeOption.modelOptions}
              />
            </div>
          </div>
        </fieldset>
      </header>
      <PoiRowsTable
        rows={rows}
        selectedAiMode={selectedAiMode}
        selectedAiModel={selectedAiModel}
        generateDraftStoryAction={generateDraftStoryAction}
        resetDraftStoryAction={resetDraftStoryAction}
        refreshStoryContentAction={refreshStoryContentAction}
        resolveRelatedPeopleAction={resolveRelatedPeopleAction}
        deleteStoryContentAction={deleteStoryContentAction}
        refreshMainImageCandidatesAction={refreshMainImageCandidatesAction}
        deleteMainImageCandidatesAction={deleteMainImageCandidatesAction}
        selectMainImageCandidateAction={selectMainImageCandidateAction}
      />
    </main>
  );
};
