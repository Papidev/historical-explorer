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
  const selectedAiModel = selectedAiModelByMode[selectedAiMode] || selectedModeOption.defaultModel;

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
            label={`Story and People model · ${selectedAiMode === "cloud" ? "Cloud" : "Local"}`}
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
      </div>
    </fieldset>
  );
};
