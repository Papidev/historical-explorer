"use client";

import { useState, useTransition } from "react";
import { MDXRemote } from "next-mdx-remote";
import { Callout } from "@/app/components/mdx/Callout";
import { MdxLink } from "@/app/components/mdx/MdxLink";
import type { AdminPoiRow } from "../lib/types";
import { SubmitButton } from "./SubmitButton";

const refreshConfirmMessages = {
  transformed:
    "Refresh transformed JSON, wiki text, AI text, and MDX for this POI?",
  wiki: "Refresh wiki text, AI text, and MDX for this POI?",
  ai: "Refresh AI text and MDX for this POI?",
  mdx: "Refresh MDX for this POI?",
} as const;

const generateConfirmMessage =
  "Generate transformed JSON, wiki text, AI text, and MDX for this POI?";

const deleteConfirmMessages = {
  transformed:
    "Delete transformed JSON, wiki text, AI text, and MDX for this POI?",
  wiki: "Delete wiki text, AI text, and MDX for this POI?",
  ai: "Delete AI text and MDX for this POI?",
  mdx: "Delete MDX for this POI?",
} as const;

const viewButtonClassName =
  "inline-flex items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white";

const CellContent = ({
  title,
  subtitle,
  updatedAt,
  generationDuration,
}: {
  title?: string;
  subtitle?: string;
  updatedAt?: string;
  generationDuration?: string;
}) =>
  title ? (
    <>
      <p className="text-sm font-medium text-black">{title}</p>
      {subtitle ? (
        <p className="mt-1 font-mono text-xs text-black/65">{subtitle}</p>
      ) : null}
      {updatedAt ? (
        <p className="mt-1 text-xs text-black/55">Updated {updatedAt}</p>
      ) : null}
      {generationDuration ? (
        <p className="mt-1 text-xs text-black/55">
          Generated in {generationDuration}
        </p>
      ) : null}
    </>
  ) : (
    <p className="text-sm text-black/45">Not generated</p>
  );

type SelectedPanel =
  | {
      poiId: string;
      title: string;
      kind: "text";
      content: string;
    }
  | {
      poiId: string;
      title: string;
      kind: "rendered";
      source: NonNullable<AdminPoiRow["aiSource"]>;
    }
  | {
      title: string;
      kind: "mdx";
      poiId: string;
      content: string;
      source: NonNullable<AdminPoiRow["mdxSource"]>;
    };

export const PoiRowsTable = ({
  rows,
  generateAction,
  refreshTransformedAction,
  refreshWikiAction,
  refreshAiAction,
  refreshMdxAction,
  saveMdxAction,
  deleteTransformedAction,
  deleteWikiAction,
  deleteAiAction,
  deleteMdxAction,
}: {
  rows: AdminPoiRow[];
  generateAction: (formData: FormData) => Promise<void>;
  refreshTransformedAction: (formData: FormData) => Promise<void>;
  refreshWikiAction: (formData: FormData) => Promise<void>;
  refreshAiAction: (formData: FormData) => Promise<void>;
  refreshMdxAction: (formData: FormData) => Promise<void>;
  saveMdxAction: (formData: FormData) => Promise<void>;
  deleteTransformedAction: (formData: FormData) => Promise<void>;
  deleteWikiAction: (formData: FormData) => Promise<void>;
  deleteAiAction: (formData: FormData) => Promise<void>;
  deleteMdxAction: (formData: FormData) => Promise<void>;
}) => {
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(
    null,
  );
  const [mdxMode, setMdxMode] = useState<"preview" | "edit">("preview");
  const [draftMdx, setDraftMdx] = useState("");
  const [versionInProgressPoiId, setVersionInProgressPoiId] = useState<
    string | null
  >(null);
  const [isSavingMdx, startSavingMdx] = useTransition();

  const runVersionAction = async (
    poiId: string,
    action: (formData: FormData) => Promise<void>,
    formData: FormData,
  ) => {
    setVersionInProgressPoiId(poiId);
    setSelectedPanel(null);
    setMdxMode("preview");
    setDraftMdx("");

    try {
      await action(formData);
    } finally {
      setVersionInProgressPoiId(null);
    }
  };

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-black/10 bg-white">
        <div className="grid shrink-0 grid-cols-5 border-b border-black/10 bg-black/[0.03] text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
          <div className="px-4 py-3">Raw</div>
          <div className="border-l border-black/10 px-4 py-3">POLISHED</div>
          <div className="border-l border-black/10 px-4 py-3">Wiki Text</div>
          <div className="border-l border-black/10 px-4 py-3">AI Text</div>
          <div className="border-l border-black/10 px-4 py-3">MDX</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-black/55">
              No POIs available.
            </p>
          ) : (
            <ul>
              {rows.map((row) => {
                const isVisualizationDisabled = versionInProgressPoiId !== null;

                return (
                  <li
                    key={row.id}
                    className="grid grid-cols-5 divide-x divide-black/10 border-b border-black/10 last:border-b-0"
                  >
                    <div className="px-4 py-3">
                      <CellContent
                        title={row.rawPoi?.name}
                        subtitle={row.id}
                        updatedAt={row.rawUpdatedAt}
                      />
                      {row.rawPoi ? (
                        <form
                          action={(formData) =>
                            runVersionAction(row.id, generateAction, formData)
                          }
                          className="mt-3"
                        >
                          <input
                            type="hidden"
                            name="rawFeatureIndex"
                            value={row.rawPoi.featureIndex}
                          />
                          <SubmitButton
                            idleLabel="Generate"
                            pendingLabel="Generating..."
                            confirmMessage={generateConfirmMessage}
                            tone="primary"
                          />
                        </form>
                      ) : null}
                    </div>
                    <div className="px-4 py-3">
                      <CellContent
                        title={row.transformedPoi ? "Available" : undefined}
                        updatedAt={row.transformedUpdatedAt}
                        generationDuration={row.transformedGenerationDuration}
                      />
                      {row.transformedPoi ? (
                        <div className="mt-3 flex flex-col items-start gap-2">
                          <button
                            type="button"
                            disabled={isVisualizationDisabled}
                            onClick={() =>
                              row.transformedJson
                                ? (setSelectedPanel({
                                    poiId: row.id,
                                    title: `${row.id} Rome JSON`,
                                    kind: "text",
                                    content: row.transformedJson,
                                  }),
                                  setMdxMode("preview"),
                                  setDraftMdx(""))
                                : null
                            }
                            className={viewButtonClassName}
                          >
                            View
                          </button>
                          <div className="flex flex-wrap gap-2">
                            <form
                              action={(formData) =>
                                runVersionAction(
                                  row.id,
                                  refreshTransformedAction,
                                  formData,
                                )
                              }
                            >
                              <input type="hidden" name="poiId" value={row.id} />
                              <SubmitButton
                                idleLabel="Refresh"
                                pendingLabel="Refreshing..."
                                confirmMessage={
                                  refreshConfirmMessages.transformed
                                }
                                tone="primary"
                              />
                            </form>
                            <form
                              action={(formData) =>
                                runVersionAction(
                                  row.id,
                                  deleteTransformedAction,
                                  formData,
                                )
                              }
                            >
                              <input type="hidden" name="poiId" value={row.id} />
                              <SubmitButton
                                idleLabel="Delete"
                                pendingLabel="Deleting..."
                                confirmMessage={
                                  deleteConfirmMessages.transformed
                                }
                                tone="danger"
                              />
                            </form>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="px-4 py-3">
                      <CellContent
                        title={row.wikiPoi ? "Available" : undefined}
                        updatedAt={row.wikiUpdatedAt}
                        generationDuration={row.wikiGenerationDuration}
                      />
                      {row.wikiPoi ? (
                        <div className="mt-3 flex flex-col items-start gap-2">
                          <button
                            type="button"
                            disabled={isVisualizationDisabled}
                            onClick={() =>
                              row.wikiText
                                ? (setSelectedPanel({
                                    poiId: row.id,
                                    title: `${row.id} Wiki Text`,
                                    kind: "text",
                                    content: row.wikiText,
                                  }),
                                  setMdxMode("preview"),
                                  setDraftMdx(""))
                                : null
                            }
                            className={viewButtonClassName}
                          >
                            View
                          </button>
                          <div className="flex flex-wrap gap-2">
                            <form
                              action={(formData) =>
                                runVersionAction(
                                  row.id,
                                  refreshWikiAction,
                                  formData,
                                )
                              }
                            >
                              <input type="hidden" name="poiId" value={row.id} />
                              <SubmitButton
                                idleLabel="Refresh"
                                pendingLabel="Refreshing..."
                                confirmMessage={refreshConfirmMessages.wiki}
                                tone="primary"
                              />
                            </form>
                            <form
                              action={(formData) =>
                                runVersionAction(
                                  row.id,
                                  deleteWikiAction,
                                  formData,
                                )
                              }
                            >
                              <input type="hidden" name="poiId" value={row.id} />
                              <SubmitButton
                                idleLabel="Delete"
                                pendingLabel="Deleting..."
                                confirmMessage={deleteConfirmMessages.wiki}
                                tone="danger"
                              />
                            </form>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="px-4 py-3">
                      <CellContent
                        title={row.aiPoi ? "Available" : undefined}
                        updatedAt={row.aiUpdatedAt}
                        generationDuration={row.aiGenerationDuration}
                      />
                      {row.aiPoi ? (
                        <div className="mt-3 flex flex-col items-start gap-2">
                          <button
                            type="button"
                            disabled={isVisualizationDisabled}
                            onClick={() =>
                              row.aiSource
                                ? (setSelectedPanel({
                                    poiId: row.id,
                                    title: `${row.id} AI Text`,
                                    kind: "rendered",
                                    source: row.aiSource,
                                  }),
                                  setMdxMode("preview"),
                                  setDraftMdx(""))
                                : null
                            }
                            className={viewButtonClassName}
                          >
                            View
                          </button>
                          <div className="flex flex-wrap gap-2">
                            <form
                              action={(formData) =>
                                runVersionAction(
                                  row.id,
                                  refreshAiAction,
                                  formData,
                                )
                              }
                            >
                              <input type="hidden" name="poiId" value={row.id} />
                              <SubmitButton
                                idleLabel="Refresh"
                                pendingLabel="Refreshing..."
                                confirmMessage={refreshConfirmMessages.ai}
                                tone="primary"
                              />
                            </form>
                            <form
                              action={(formData) =>
                                runVersionAction(
                                  row.id,
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
                              />
                            </form>
                          </div>
                        </div>
                      ) : row.wikiPoi ? (
                        <form
                          action={(formData) =>
                            runVersionAction(row.id, refreshAiAction, formData)
                          }
                          className="mt-3"
                        >
                          <input type="hidden" name="poiId" value={row.id} />
                          <SubmitButton
                            idleLabel="Generate"
                            pendingLabel="Generating..."
                            confirmMessage={refreshConfirmMessages.ai}
                            tone="primary"
                          />
                        </form>
                      ) : null}
                    </div>
                    <div className="px-4 py-3">
                      <CellContent
                        title={row.mdxPoi ? "Available" : undefined}
                        updatedAt={row.mdxUpdatedAt}
                        generationDuration={row.mdxGenerationDuration}
                      />
                      {row.mdxPoi ? (
                        <div className="mt-3 flex flex-col items-start gap-2">
                          <button
                            type="button"
                            disabled={isVisualizationDisabled}
                            onClick={() =>
                              row.mdxSource
                                ? (setSelectedPanel({
                                    poiId: row.id,
                                    title: `${row.id} MDX`,
                                    kind: "mdx",
                                    content: row.mdxContent ?? "",
                                    source: row.mdxSource,
                                  }),
                                  setMdxMode("preview"),
                                  setDraftMdx(row.mdxContent ?? ""))
                                : null
                            }
                            className={viewButtonClassName}
                          >
                            View
                          </button>
                          <div className="flex flex-wrap gap-2">
                            <form
                              action={(formData) =>
                                runVersionAction(
                                  row.id,
                                  refreshMdxAction,
                                  formData,
                                )
                              }
                            >
                              <input type="hidden" name="poiId" value={row.id} />
                              <SubmitButton
                                idleLabel="Refresh"
                                pendingLabel="Refreshing..."
                                confirmMessage={refreshConfirmMessages.mdx}
                                tone="primary"
                              />
                            </form>
                            <form
                              action={(formData) =>
                                runVersionAction(
                                  row.id,
                                  deleteMdxAction,
                                  formData,
                                )
                              }
                            >
                              <input type="hidden" name="poiId" value={row.id} />
                              <SubmitButton
                                idleLabel="Delete"
                                pendingLabel="Deleting..."
                                confirmMessage={deleteConfirmMessages.mdx}
                                tone="danger"
                              />
                            </form>
                          </div>
                        </div>
                      ) : row.aiPoi ? (
                        <form
                          action={(formData) =>
                            runVersionAction(row.id, refreshMdxAction, formData)
                          }
                          className="mt-3"
                        >
                          <input type="hidden" name="poiId" value={row.id} />
                          <SubmitButton
                            idleLabel="Generate"
                            pendingLabel="Generating..."
                            confirmMessage={refreshConfirmMessages.mdx}
                            tone="primary"
                          />
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
      {selectedPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6">
          <div className="flex h-[min(80vh,720px)] w-[min(960px,100%)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-black">
                  {selectedPanel.title}
                </p>
                {selectedPanel.kind === "mdx" ? (
                  <div className="flex rounded-md border border-black/10 bg-neutral-100 p-1">
                    <button
                      type="button"
                      onClick={() => setMdxMode("preview")}
                      className={`rounded px-2 py-1 text-xs font-medium transition ${
                        mdxMode === "preview"
                          ? "bg-white text-black shadow-sm"
                          : "text-black/60 hover:text-black"
                      }`}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setMdxMode("edit")}
                      className={`rounded px-2 py-1 text-xs font-medium transition ${
                        mdxMode === "edit"
                          ? "bg-white text-black shadow-sm"
                          : "text-black/60 hover:text-black"
                      }`}
                    >
                      Edit
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {selectedPanel.kind === "mdx" && mdxMode === "edit" ? (
                  <button
                    type="button"
                    disabled={isSavingMdx}
                    onClick={() => {
                      startSavingMdx(async () => {
                        const formData = new FormData();
                        formData.set("poiId", selectedPanel.poiId);
                        formData.set("content", draftMdx);
                        await saveMdxAction(formData);
                        setSelectedPanel(null);
                        setMdxMode("preview");
                        setDraftMdx("");
                      });
                    }}
                    className="inline-flex items-center rounded-md border border-black/15 bg-black px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingMdx ? "Saving..." : "Save"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPanel(null);
                    setMdxMode("preview");
                    setDraftMdx("");
                  }}
                  className="inline-flex items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03]"
                >
                  Close
                </button>
              </div>
            </div>
            {selectedPanel.kind === "text" ? (
              <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words bg-neutral-50 px-5 py-4 text-xs leading-5 text-black">
                {selectedPanel.content}
              </pre>
            ) : null}
            {selectedPanel.kind === "rendered" ? (
              <div className="flex-1 overflow-auto bg-neutral-50 px-5 py-4 text-sm leading-6 text-black">
                <div className="poi-dialog-content">
                  <MDXRemote
                    {...selectedPanel.source}
                    components={{ Callout, a: MdxLink }}
                  />
                </div>
              </div>
            ) : null}
            {selectedPanel.kind === "mdx" && mdxMode === "preview" ? (
              <div className="flex-1 overflow-auto bg-neutral-50 px-5 py-4 text-sm leading-6 text-black">
                <div className="poi-dialog-content">
                  <MDXRemote
                    {...selectedPanel.source}
                    components={{ Callout, a: MdxLink }}
                  />
                </div>
              </div>
            ) : null}
            {selectedPanel.kind === "mdx" && mdxMode === "edit" ? (
              <div className="flex-1 overflow-auto bg-neutral-50 p-5">
                <textarea
                  value={draftMdx}
                  onChange={(event) => setDraftMdx(event.target.value)}
                  spellCheck={false}
                  className="h-full min-h-full w-full resize-none rounded-xl border border-black/10 bg-white p-4 font-mono text-sm leading-6 text-black shadow-inner outline-none"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
