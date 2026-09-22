"use client";

import { useState } from "react";
import type { RefObject } from "react";
import { ListboxSelect } from "@/app/components/ui/ListboxSelect";
import { Toggle } from "@/app/components/ui/Toggle";
import type { AiMode, AiModeOption, AiSelection } from "../lib/aiModels";

const getModeOption = (aiModeOptions: readonly AiModeOption[], mode: AiMode) =>
  aiModeOptions.find((option) => option.mode === mode) ?? aiModeOptions[0];

export const AiGenerationSettings = ({
  aiModeOptions,
  initialAiSelection,
  selectionRef,
}: {
  aiModeOptions: readonly AiModeOption[];
  initialAiSelection: AiSelection;
  selectionRef: RefObject<Pick<AiSelection, "mode" | "model">>;
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
  const localModeOption = getModeOption(aiModeOptions, "local");
  const selectedAiModel = selectedAiModelByMode[selectedAiMode] || selectedModeOption.defaultModel;
  const localPeopleModel = localModeOption.defaultModel;
  const localPeopleModelLabel =
    localModeOption.modelOptions.find(({ value }) => value === localPeopleModel)?.label ??
    localPeopleModel;

  return (
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
          onChange={(checked) => {
            const mode = checked ? "cloud" : "local";
            selectionRef.current = {
              mode,
              model: selectedAiModelByMode[mode] || getModeOption(aiModeOptions, mode).defaultModel,
            };
            setSelectedAiMode(mode);
          }}
        />
        <div className="min-w-72">
          <ListboxSelect
            label={
              selectedAiMode === "cloud" ? "Story model · Cloud" : "Story and People model · Local"
            }
            value={selectedAiModel}
            onChange={(model) => {
              selectionRef.current = { mode: selectedAiMode, model };
              setSelectedAiModelByMode({
                ...selectedAiModelByMode,
                [selectedAiMode]: model,
              });
            }}
            options={selectedModeOption.modelOptions}
          />
        </div>
        {selectedAiMode === "cloud" ? (
          <div className="min-w-72">
            <p className="text-sm/6 font-medium text-gray-900">People model · Local</p>
            <div className="mt-2 flex min-h-9 items-center justify-between gap-3 rounded-md bg-amber-50 py-1.5 pr-2 pl-3 text-sm/6 text-gray-900 outline-1 -outline-offset-1 outline-amber-300">
              <span className="truncate">{localPeopleModelLabel}</span>
              <span className="shrink-0 text-xs font-medium text-amber-800">Ollama · free</span>
            </div>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
};
