"use client";

import { useState } from "react";
import type { AiMode, AiModeOption, AiSelection } from "../lib/aiModels";
import type { AdminPoiRow } from "../lib/types";
import { PoiRowsTable } from "./PoiRowsTable";

const getModeOption = (
  aiModeOptions: readonly AiModeOption[],
  mode: AiMode,
) => aiModeOptions.find((option) => option.mode === mode) ?? aiModeOptions[0];

const getModelLabel = (modeOption: AiModeOption, model: string) =>
  modeOption.modelOptions.find((option) => option.value === model)?.label ??
  model;

export const AdminDashboard = ({
  rows,
  aiModeOptions,
  initialAiSelection,
  generateTransformedAction,
  refreshWikiAction,
  refreshAiAction,
  deleteAiAction,
}: {
  rows: AdminPoiRow[];
  aiModeOptions: readonly AiModeOption[];
  initialAiSelection: AiSelection;
  generateTransformedAction: (formData: FormData) => Promise<void>;
  refreshWikiAction: (formData: FormData) => Promise<void>;
  refreshAiAction: (formData: FormData) => Promise<void>;
  deleteAiAction: (formData: FormData) => Promise<void>;
}) => {
  const [selectedAiMode, setSelectedAiMode] = useState(initialAiSelection.mode);
  const [selectedAiModelByMode, setSelectedAiModelByMode] = useState<
    Record<AiMode, string>
  >({
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
  const selectedAiModel =
    selectedAiModelByMode[selectedAiMode] || selectedModeOption.defaultModel;

  return (
    <main className="flex h-screen min-h-screen flex-col bg-neutral-50 p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-black">POI Import</h1>
          <p className="mt-1 text-xs text-black/55">
            AI generations use {getModelLabel(selectedModeOption, selectedAiModel)} via{" "}
            {selectedModeOption.providerLabel}
            {selectedAiMode === "cloud" ? " API, paid usage." : " locally, free usage."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 text-sm text-black">
            <span className="text-xs font-medium tracking-[0.08em] text-black/55 uppercase">
              AI provider
            </span>
            <div
              className="grid grid-cols-2 rounded-md border border-black/15 bg-white p-0.5"
              role="group"
              aria-label="AI provider"
            >
              {aiModeOptions.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  aria-pressed={selectedAiMode === option.mode}
                  onClick={() => setSelectedAiMode(option.mode)}
                  className={`rounded-[5px] px-3 py-1.5 text-sm font-medium transition ${
                    selectedAiMode === option.mode
                      ? "bg-black text-white"
                      : "text-black hover:bg-black/[0.04]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm text-black">
            <span className="text-xs font-medium tracking-[0.08em] text-black/55 uppercase">
              Model
            </span>
            <select
              value={selectedAiModel}
              onChange={(event) =>
                setSelectedAiModelByMode({
                  ...selectedAiModelByMode,
                  [selectedAiMode]: event.target.value,
                })
              }
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm font-medium text-black transition outline-none hover:bg-black/[0.03]"
            >
              {selectedModeOption.modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <PoiRowsTable
        rows={rows}
        selectedAiMode={selectedAiMode}
        selectedAiModel={selectedAiModel}
        generateTransformedAction={generateTransformedAction}
        refreshWikiAction={refreshWikiAction}
        refreshAiAction={refreshAiAction}
        deleteAiAction={deleteAiAction}
      />
    </main>
  );
};
