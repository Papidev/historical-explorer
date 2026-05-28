"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import type { AiModelOption } from "../lib/aiModels";
import type { AdminPoiRow } from "../lib/types";
import { SubmitButton } from "./SubmitButton";

const refreshConfirmMessages = {
  ai: "Refresh AI Markdown for this POI?",
} as const;

const generateConfirmMessage =
  "Generate transformed JSON, wiki text, and AI Markdown for this POI?";

type ProgressStep = {
  description: string;
  action: (formData: FormData) => Promise<void>;
  formData: FormData;
};

type ProgressState = {
  poiId: string;
  description: string;
};

const deleteConfirmMessages = {
  ai: "Delete AI Markdown for this POI?",
} as const;

const viewButtonClassName =
  "inline-flex items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white";

const sanitizeDownloadNamePart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");

const getAiDownloadFileName = (row: AdminPoiRow) =>
  `${sanitizeDownloadNamePart(row.id)}--${sanitizeDownloadNamePart(row.aiGenerationModel ?? "unknown-model")}.md`;

const getAiDownloadHref = (content: string) =>
  `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`;

const CellContent = ({
  title,
  subtitle,
  updatedAt,
  generationDuration,
  generationModel,
  titleTone = "status",
}: {
  title?: string;
  subtitle?: string;
  updatedAt?: string;
  generationDuration?: string;
  generationModel?: string;
  titleTone?: "poi" | "status";
}) => (
  <div className="min-w-0">
    <p
      className={`leading-snug break-words ${
        title
          ? titleTone === "poi"
            ? "text-base font-semibold text-black"
            : "text-xs font-semibold text-emerald-700"
          : "text-sm text-black/35"
      }`}
    >
      {title ?? "Not generated"}
    </p>
    {subtitle ? (
      <p className="mt-1 font-mono text-xs leading-snug break-words text-black/65">{subtitle}</p>
    ) : null}
    {updatedAt ? (
      <p className="mt-1 text-xs leading-snug text-black/55">Updated {updatedAt}</p>
    ) : null}
    {generationDuration ? (
      <p className="mt-1 text-xs leading-snug text-black/55">Generated in {generationDuration}</p>
    ) : null}
    {generationModel ? (
      <p className="mt-1 text-xs leading-snug text-black/55">Model {generationModel}</p>
    ) : null}
  </div>
);

const CellActions = ({ children }: { children?: ReactNode }) =>
  children ? <div className="mt-2">{children}</div> : null;

const ProgressMessage = ({ description }: { description: string }) => (
  <p className="mt-2 text-xs font-medium text-black/65" aria-live="polite">
    {description}
  </p>
);

type SelectedPanel =
  | {
      title: string;
      kind: "text";
      content: string;
    }
  | {
      title: string;
      kind: "markdown";
      content: string;
    };

export const PoiRowsTable = ({
  rows,
  aiModelOptions,
  defaultAiModel,
  generateTransformedAction,
  refreshWikiAction,
  refreshAiAction,
  deleteAiAction,
}: {
  rows: AdminPoiRow[];
  aiModelOptions: readonly AiModelOption[];
  defaultAiModel: string;
  generateTransformedAction: (formData: FormData) => Promise<void>;
  refreshWikiAction: (formData: FormData) => Promise<void>;
  refreshAiAction: (formData: FormData) => Promise<void>;
  deleteAiAction: (formData: FormData) => Promise<void>;
}) => {
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(null);
  const [selectedAiModel, setSelectedAiModel] = useState(defaultAiModel);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const createPoiFormData = (poiId: string) => {
    const formData = new FormData();
    formData.set("poiId", poiId);
    formData.set("aiModel", selectedAiModel);

    return formData;
  };

  const runPipeline = async (poiId: string, steps: ProgressStep[]) => {
    setSelectedPanel(null);

    try {
      for (const step of steps) {
        setProgress({ poiId, description: step.description });
        await step.action(step.formData);
      }
    } finally {
      setProgress(null);
    }
  };

  const runSingleAction = async (
    poiId: string,
    description: string,
    action: (formData: FormData) => Promise<void>,
    formData: FormData,
  ) =>
    runPipeline(poiId, [
      {
        description,
        action,
        formData,
      },
    ]);

  return (
    <>
      <section className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium text-black">AI model</p>
          <p className="text-xs text-black/55">
            Used for the next AI generations in this admin session.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-black">
          <span className="text-xs font-medium tracking-[0.08em] text-black/55 uppercase">
            Model
          </span>
          <select
            value={selectedAiModel}
            onChange={(event) => setSelectedAiModel(event.target.value)}
            disabled={progress !== null || aiModelOptions.length === 0}
            className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm font-medium text-black transition outline-none hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiModelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-black/10 bg-white">
        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-black/55">No POIs available.</p>
          ) : (
            <table className="w-full table-fixed border-collapse">
              <thead className="sticky top-0 z-10 bg-neutral-100 text-xs font-semibold tracking-[0.08em] text-black/65 uppercase">
                <tr>
                  <th scope="col" className="border-r border-b border-black/10 px-4 py-2 text-left">
                    Raw
                  </th>
                  <th scope="col" className="border-r border-b border-black/10 px-4 py-2 text-left">
                    Polished
                  </th>
                  <th scope="col" className="border-r border-b border-black/10 px-4 py-2 text-left">
                    Wiki Text
                  </th>
                  <th scope="col" className="border-b border-black/10 px-4 py-2 text-left">
                    AI Markdown
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isRowInProgress = progress?.poiId === row.id;
                  const isVisualizationDisabled = isRowInProgress;
                  const progressDescription =
                    isRowInProgress ? progress.description : null;

                  return (
                    <tr key={row.id} className="border-b border-black/10">
                      <td className="min-w-0 border-r border-black/10 px-4 py-2 align-top">
                        <CellContent
                          title={row.rawPoi?.name}
                          subtitle={row.id}
                          updatedAt={row.rawUpdatedAt}
                          titleTone="poi"
                        />
                        <CellActions>
                          {row.rawPoi ? (
                            <form
                              action={(formData) =>
                                runPipeline(row.id, [
                                  {
                                    description: "Polishing POI metadata...",
                                    action: generateTransformedAction,
                                    formData,
                                  },
                                  {
                                    description: "Fetching Wikipedia text...",
                                    action: refreshWikiAction,
                                    formData: createPoiFormData(row.id),
                                  },
                                  {
                                    description: "Generating AI Markdown...",
                                    action: refreshAiAction,
                                    formData: createPoiFormData(row.id),
                                  },
                                ])
                              }
                            >
                              <input
                                type="hidden"
                                name="rawFeatureIndex"
                                value={row.rawPoi.featureIndex}
                              />
                              <input type="hidden" name="aiModel" value={selectedAiModel} />
                              <SubmitButton
                                idleLabel="Generate"
                                pendingLabel="Generating..."
                                confirmMessage={generateConfirmMessage}
                                tone="primary"
                                disabled={isRowInProgress}
                              />
                            </form>
                          ) : null}
                        </CellActions>
                        {progressDescription ? (
                          <ProgressMessage description={progressDescription} />
                        ) : null}
                      </td>
                      <td className="min-w-0 border-r border-black/10 px-4 py-2 align-top">
                        <CellContent
                          title={row.transformedPoi ? "Available" : undefined}
                          updatedAt={row.transformedUpdatedAt}
                          generationDuration={row.transformedGenerationDuration}
                        />
                        <CellActions>
                          {row.transformedPoi ? (
                            <button
                              type="button"
                              disabled={isVisualizationDisabled}
                              onClick={() =>
                                row.transformedJson
                                  ? setSelectedPanel({
                                      title: `${row.id} Rome JSON`,
                                      kind: "text",
                                      content: row.transformedJson,
                                    })
                                  : null
                              }
                              className={viewButtonClassName}
                            >
                              View
                            </button>
                          ) : null}
                        </CellActions>
                      </td>
                      <td className="min-w-0 border-r border-black/10 px-4 py-2 align-top">
                        <CellContent
                          title={row.wikiPoi ? "Available" : undefined}
                          updatedAt={row.wikiUpdatedAt}
                          generationDuration={row.wikiGenerationDuration}
                        />
                        <CellActions>
                          {row.wikiPoi ? (
                            <button
                              type="button"
                              disabled={isVisualizationDisabled}
                              onClick={() =>
                                row.wikiText
                                  ? setSelectedPanel({
                                      title: `${row.id} Wiki Text`,
                                      kind: "text",
                                      content: row.wikiText,
                                    })
                                  : null
                              }
                              className={viewButtonClassName}
                            >
                              View
                            </button>
                          ) : null}
                        </CellActions>
                      </td>
                      <td className="min-w-0 px-4 py-2 align-top">
                        <CellContent
                          title={row.aiPoi ? "Available" : undefined}
                          updatedAt={row.aiUpdatedAt}
                          generationDuration={row.aiGenerationDuration}
                          generationModel={
                            row.aiPoi ? (row.aiGenerationModel ?? "unknown") : undefined
                          }
                        />
                        <CellActions>
                          {row.aiPoi ? (
                            <div className="flex flex-col items-start gap-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={isVisualizationDisabled}
                                  onClick={() =>
                                    row.aiText
                                      ? setSelectedPanel({
                                          title: `${row.id} AI Markdown`,
                                          kind: "markdown",
                                          content: row.aiText,
                                        })
                                      : null
                                  }
                                  className={viewButtonClassName}
                                >
                                  View
                                </button>
                                {row.aiText ? (
                                  isVisualizationDisabled ? (
                                    <span
                                      className={`${viewButtonClassName} cursor-not-allowed opacity-50 hover:bg-white`}
                                      aria-disabled="true"
                                    >
                                      Download
                                    </span>
                                  ) : (
                                    <a
                                      href={getAiDownloadHref(row.aiText)}
                                      download={getAiDownloadFileName(row)}
                                      className={viewButtonClassName}
                                    >
                                      Download
                                    </a>
                                  )
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <form
                                  action={(formData) =>
                                    runSingleAction(
                                      row.id,
                                      "Generating AI Markdown...",
                                      refreshAiAction,
                                      formData,
                                    )
                                  }
                                >
                                  <input type="hidden" name="poiId" value={row.id} />
                                  <input type="hidden" name="aiModel" value={selectedAiModel} />
                                  <SubmitButton
                                    idleLabel="Refresh"
                                    pendingLabel="Refreshing..."
                                    confirmMessage={refreshConfirmMessages.ai}
                                    tone="primary"
                                    disabled={isRowInProgress}
                                  />
                                </form>
                                <form
                                  action={(formData) =>
                                    runSingleAction(
                                      row.id,
                                      "Deleting AI Markdown...",
                                      deleteAiAction,
                                      formData,
                                    )
                                  }
                                >
                                  <input type="hidden" name="poiId" value={row.id} />
                                  <SubmitButton
                                    idleLabel="Delete"
                                    pendingLabel="Deleting..."
                                    confirmMessage={deleteConfirmMessages.ai}
                                    tone="danger"
                                    disabled={isRowInProgress}
                                  />
                                </form>
                              </div>
                            </div>
                          ) : row.wikiPoi ? (
                            <form
                              action={(formData) =>
                                runSingleAction(
                                  row.id,
                                  "Generating AI Markdown...",
                                  refreshAiAction,
                                  formData,
                                )
                              }
                            >
                              <input type="hidden" name="poiId" value={row.id} />
                              <input type="hidden" name="aiModel" value={selectedAiModel} />
                              <SubmitButton
                                idleLabel="Generate"
                                pendingLabel="Generating..."
                                confirmMessage={refreshConfirmMessages.ai}
                                tone="primary"
                                disabled={isRowInProgress}
                              />
                            </form>
                          ) : null}
                        </CellActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
      {selectedPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6">
          <div className="flex h-[min(80vh,720px)] w-[min(960px,100%)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <p className="text-sm font-semibold text-black">{selectedPanel.title}</p>
              <button
                type="button"
                onClick={() => setSelectedPanel(null)}
                className="inline-flex items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03]"
              >
                Close
              </button>
            </div>
            {selectedPanel.kind === "text" ? (
              <pre className="flex-1 overflow-auto bg-neutral-50 px-5 py-4 text-xs leading-5 break-words whitespace-pre-wrap text-black">
                {selectedPanel.content}
              </pre>
            ) : null}
            {selectedPanel.kind === "markdown" ? (
              <div className="flex-1 overflow-auto bg-neutral-50 px-5 py-4 text-sm leading-6 text-black">
                <MarkdownContent content={selectedPanel.content} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
