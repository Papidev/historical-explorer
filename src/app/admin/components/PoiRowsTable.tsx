"use client";

import {
  ArrowPathIcon,
  DocumentTextIcon,
  EyeIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { IconButton } from "@/app/components/ui/IconButton";
import type { Source, StoryContent } from "@/server/storyWorkflow";
import type { AiMode, AiModel } from "../lib/aiModels";
import type { AdminPoiRow, MainImageCandidate, MainImageCandidatesArtifact } from "../lib/types";
import { SubmitButton } from "./SubmitButton";

const refreshConfirmMessages = {
  storyContent: "Refresh Story Content for this POI?",
  mainImage: "Refresh Main Image Candidates for this POI?",
} as const;

const generateConfirmMessage = "Generate a Point of Interest and Draft Story for this Geo Place?";

type ProgressState = {
  poiId: string;
  description: string;
};

const getActionErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "The action failed. Please try again.";

const deleteConfirmMessages = {
  transformed:
    "Reset this row? This deletes generated POI, Wikipedia Text, Story, and Main Image Candidates for this POI.",
  storyContent: "Delete Story Content for this POI?",
  mainImage: "Delete Main Image Candidates for this POI?",
} as const;

const actionGroupClassName = "flex flex-wrap items-center gap-1.5";

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
  <div className="min-h-32 min-w-0">
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
      <p className="mt-1 text-xs leading-snug text-black/55">
        Updated: <span className="font-bold">{updatedAt}</span>
      </p>
    ) : null}
    {generationDuration ? (
      <p className="mt-1 text-xs leading-snug text-black/55">
        Generated: <span className="font-bold">{generationDuration}</span>
      </p>
    ) : null}
    {generationModel ? (
      <p className="mt-1 text-xs leading-snug text-black/55">
        Model: <span className="font-bold">{generationModel}</span>
      </p>
    ) : null}
  </div>
);

const CellActions = ({ children }: { children?: ReactNode }) =>
  children ? <div className="pt-3">{children}</div> : null;

const ColumnHeader = ({ title, path }: { title: string; path?: string }) => (
  <div>
    <p className="text-xs font-semibold tracking-[0.08em] text-gray-600 uppercase">{title}</p>
    {path ? (
      <p className="mt-1 max-w-full truncate font-mono text-[0.6875rem] leading-snug text-gray-400 normal-case">
        {path}
      </p>
    ) : null}
  </div>
);

const ProgressMessage = ({ description }: { description: string }) => (
  <p className="mt-2 text-xs font-medium text-black/65" aria-live="polite">
    {description}
  </p>
);

const ErrorToast = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  return (
    <div
      role="alert"
      className="fixed top-4 right-4 z-50 flex max-w-md items-start gap-4 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-800 shadow-lg ring-1 ring-black/5"
    >
      <p className="flex-1">
        <span className="font-semibold">Story refresh failed.</span> {message}
      </p>
      <button
        type="button"
        aria-label="Dismiss error"
        className="-m-1 rounded p-1 text-red-700/70 hover:bg-red-50 hover:text-red-900"
        onClick={onDismiss}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
};

type SelectedPanel =
  | {
      title: string;
      kind: "text";
      content: string;
    }
  | {
      title: string;
      kind: "storyContent";
      content: StoryContent;
      sources: Source[];
    }
  | {
      title: string;
      kind: "mainImage";
      poiId: string;
      artifact: MainImageCandidatesArtifact;
    };

const isCandidateSelectable = (candidate: MainImageCandidate) =>
  Boolean(candidate.license && candidate.attribution);

const getSelectedMainImageCandidate = (artifact?: MainImageCandidatesArtifact) =>
  artifact?.candidates.find(
    (candidate) => candidate.commonsFileName === artifact.selectedCommonsFileName,
  );

const MainImageCellPreview = ({ artifact }: { artifact?: MainImageCandidatesArtifact }) => {
  const selectedCandidate = getSelectedMainImageCandidate(artifact);
  if (!selectedCandidate) {
    return null;
  }

  return (
    <a
      href={selectedCandidate.commonsPageUrl}
      target="_blank"
      rel="noreferrer"
      className="block h-20 w-28 shrink-0 overflow-hidden rounded-md border border-black/10 bg-neutral-100"
    >
      <Image
        src={selectedCandidate.thumbnailUrl}
        alt={selectedCandidate.commonsFileName}
        width={selectedCandidate.width ?? 160}
        height={selectedCandidate.height ?? 120}
        sizes="112px"
        unoptimized
        className="h-full w-full object-cover"
      />
    </a>
  );
};

const getMainImageStatus = (artifact?: MainImageCandidatesArtifact) => {
  if (!artifact) {
    return undefined;
  }

  if (artifact.candidates.length === 0) {
    return "No candidates";
  }

  if (getSelectedMainImageCandidate(artifact)) {
    return "Available";
  }

  if (artifact.candidates.every((candidate) => !isCandidateSelectable(candidate))) {
    return "Missing metadata";
  }

  return "Needs selection";
};

const SourceLinks = ({ sourceIds, sources }: { sourceIds: string[]; sources: Source[] }) => (
  <p className="mt-1 flex flex-wrap gap-2 text-xs text-black/50">
    Sources:
    {sourceIds.map((sourceId) => {
      const source = sources.find((item) => item.id === sourceId);
      return source ? (
        <a
          key={sourceId}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-700 underline"
        >
          {source.title}
        </a>
      ) : (
        <span key={sourceId}>{sourceId}</span>
      );
    })}
  </p>
);

const StoryContentPreview = ({
  content,
  sources,
}: {
  content: StoryContent;
  sources: Source[];
}) => (
  <div className="flex-1 space-y-6 overflow-auto bg-neutral-50 px-5 py-4 text-sm leading-6 text-black">
    <section>
      <h3 className="font-semibold">Introduction</h3>
      <p>{content.introduction.text}</p>
      <SourceLinks sourceIds={content.introduction.sourceIds} sources={sources} />
    </section>
    {Object.entries(content.topics).map(([topic, insights]) =>
      insights.length > 0 ? (
        <section key={topic}>
          <h3 className="font-semibold capitalize">{topic}</h3>
          <div className="mt-2 space-y-4">
            {insights.map((insight) => (
              <article key={insight.id} className="rounded-lg border border-black/10 bg-white p-3">
                {"time" in insight && insight.time ? (
                  <p className="font-mono text-xs text-black/55">{JSON.stringify(insight.time)}</p>
                ) : null}
                <p>{insight.description}</p>
                <SourceLinks sourceIds={insight.sourceIds} sources={sources} />
              </article>
            ))}
          </div>
        </section>
      ) : null,
    )}
    {content.relatedPeople.length > 0 ? (
      <section>
        <h3 className="font-semibold">Related People</h3>
        <div className="mt-2 space-y-4">
          {content.relatedPeople.map((person) => (
            <article key={person.id} className="rounded-lg border border-black/10 bg-white p-3">
              <p className="font-semibold">{person.name}</p>
              <p>{person.relationship}</p>
              <SourceLinks sourceIds={person.sourceIds} sources={sources} />
            </article>
          ))}
        </div>
      </section>
    ) : null}
  </div>
);

export const PoiRowsTable = ({
  rows,
  selectedAiMode,
  selectedAiModel,
  generateDraftStoryAction,
  resetDraftStoryAction,
  refreshStoryContentAction,
  deleteStoryContentAction,
  refreshMainImageCandidatesAction,
  deleteMainImageCandidatesAction,
  selectMainImageCandidateAction,
}: {
  rows: AdminPoiRow[];
  selectedAiMode: AiMode;
  selectedAiModel: AiModel;
  generateDraftStoryAction: (formData: FormData) => Promise<void>;
  resetDraftStoryAction: (formData: FormData) => Promise<void>;
  refreshStoryContentAction: (formData: FormData) => Promise<void>;
  deleteStoryContentAction: (formData: FormData) => Promise<void>;
  refreshMainImageCandidatesAction: (formData: FormData) => Promise<void>;
  deleteMainImageCandidatesAction: (formData: FormData) => Promise<void>;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runSingleAction = async (
    poiId: string,
    description: string,
    action: (formData: FormData) => Promise<void>,
    formData: FormData,
  ) => {
    setSelectedPanel(null);
    setActionError(null);
    setProgress({ poiId, description });
    try {
      await action(formData);
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      {actionError ? (
        <ErrorToast message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-950/10">
        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-black/55">No POIs available.</p>
          ) : (
            <table className="min-w-[1200px] table-fixed divide-y divide-gray-300">
              <colgroup>
                <col className="w-[19%]" />
                <col className="w-[19%]" />
                <col className="w-[19%]" />
                <col className="w-[19%]" />
                <col className="w-[24%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-amber-50">
                <tr>
                  <th
                    scope="col"
                    className="border-r border-b border-gray-200 py-2 pr-3 pl-4 text-left align-top"
                  >
                    <ColumnHeader title="Geo Place" path="data/rome/pois/raw.geojson" />
                  </th>
                  <th
                    scope="col"
                    className="border-r border-b border-gray-200 px-3 py-2 text-left align-top"
                  >
                    <ColumnHeader title="POI" path="data/rome/pois/pois.geojson" />
                  </th>
                  <th
                    scope="col"
                    className="border-r border-b border-gray-200 px-3 py-2 text-left align-top"
                  >
                    <ColumnHeader title="Wikipedia Text" path="data/rome/generated/wiki/*.txt" />
                  </th>
                  <th
                    scope="col"
                    className="border-r border-b border-gray-200 px-3 py-2 text-left align-top"
                  >
                    <ColumnHeader title="Story" path="data/rome/stories/<poi-id>/story.json" />
                  </th>
                  <th
                    scope="col"
                    className="border-b border-gray-200 py-2 pr-4 pl-3 text-left align-top"
                  >
                    <ColumnHeader
                      title="Main Image"
                      path="data/rome/stories/<poi-id>/images.json"
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {rows.map((row) => {
                  const isRowInProgress = progress?.poiId === row.id;
                  const isVisualizationDisabled = isRowInProgress;
                  const progressDescription = isRowInProgress ? progress.description : null;
                  const isRowEmpty =
                    !row.transformedPoi &&
                    !row.wikiPoi &&
                    !row.storyContent &&
                    !row.mainImageArtifact;

                  return (
                    <tr key={row.id} className="hover:bg-gray-50/60">
                      <td className="min-w-0 border-r border-gray-100 py-2 pr-3 pl-4 align-top">
                        <CellContent
                          title={row.rawPoi?.name}
                          subtitle={row.rawPoi?.wikidata ?? row.rawPoi?.id}
                          updatedAt={row.rawUpdatedAt}
                          titleTone="poi"
                        />
                        {progressDescription ? (
                          <ProgressMessage description={progressDescription} />
                        ) : null}
                        <CellActions>
                          {row.rawPoi ? (
                            isRowEmpty ? (
                              <form
                                action={(formData) =>
                                  runSingleAction(
                                    row.id,
                                    "Generating Draft Story...",
                                    generateDraftStoryAction,
                                    formData,
                                  )
                                }
                              >
                                <input type="hidden" name="geoPlaceId" value={row.rawPoi.id} />
                                <input type="hidden" name="aiMode" value={selectedAiMode} />
                                <input type="hidden" name="aiModel" value={selectedAiModel} />
                                <SubmitButton
                                  idleLabel="Generate"
                                  pendingLabel="Generating..."
                                  confirmMessage={generateConfirmMessage}
                                  icon={<PlusIcon />}
                                  tone="primary"
                                  disabled={isRowInProgress}
                                />
                              </form>
                            ) : (
                              <form
                                action={(formData) =>
                                  runSingleAction(
                                    row.id,
                                    "Resetting row...",
                                    resetDraftStoryAction,
                                    formData,
                                  )
                                }
                              >
                                <input type="hidden" name="poiId" value={row.id} />
                                <SubmitButton
                                  idleLabel="Reset"
                                  pendingLabel="Resetting..."
                                  confirmMessage={deleteConfirmMessages.transformed}
                                  icon={<ArrowPathIcon />}
                                  tone="danger"
                                  disabled={isRowInProgress}
                                />
                              </form>
                            )
                          ) : null}
                        </CellActions>
                      </td>
                      <td className="min-w-0 border-r border-gray-100 px-3 py-2 align-top">
                        <CellContent
                          title={row.transformedPoi ? "Available" : undefined}
                          subtitle={row.transformedPoi?.id}
                          updatedAt={row.transformedUpdatedAt}
                          generationDuration={row.transformedGenerationDuration}
                        />
                        <CellActions>
                          {row.transformedPoi ? (
                            <div className={actionGroupClassName}>
                              <IconButton
                                type="button"
                                label="View POI JSON"
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
                              >
                                <EyeIcon />
                              </IconButton>
                            </div>
                          ) : null}
                        </CellActions>
                      </td>
                      <td className="min-w-0 border-r border-gray-100 px-3 py-2 align-top">
                        <CellContent
                          title={row.wikiPoi ? "Available" : undefined}
                          updatedAt={row.wikiUpdatedAt}
                          generationDuration={row.wikiGenerationDuration}
                        />
                        <CellActions>
                          {row.wikiPoi ? (
                            <IconButton
                              type="button"
                              label="View Wikipedia Text"
                              disabled={isVisualizationDisabled}
                              onClick={() =>
                                row.wikiText
                                  ? setSelectedPanel({
                                      title: `${row.id} Wikipedia Text`,
                                      kind: "text",
                                      content: row.wikiText,
                                    })
                                  : null
                              }
                            >
                              <EyeIcon />
                            </IconButton>
                          ) : null}
                        </CellActions>
                      </td>
                      <td className="min-w-0 border-r border-gray-100 px-3 py-2 align-top">
                        <div>
                          <p className="text-xs font-semibold text-black">Story Content</p>
                          <p
                            className={
                              row.storyContent
                                ? "text-xs text-emerald-700"
                                : "text-xs text-black/35"
                            }
                          >
                            {row.storyContent ? "Available" : "Not generated"}
                          </p>
                          {row.storyContentGenerationModel ? (
                            <p className="mt-1 text-xs text-black/55">
                              Model:{" "}
                              {[
                                row.storyContentGenerationMode,
                                row.storyContentGenerationProvider,
                                row.storyContentGenerationModel,
                              ]
                                .filter(Boolean)
                                .join(" / ")}
                            </p>
                          ) : null}
                          <CellActions>
                            <div className={actionGroupClassName}>
                              {row.storyContent ? (
                                <IconButton
                                  type="button"
                                  label="View Story Content"
                                  disabled={isVisualizationDisabled}
                                  onClick={() =>
                                    row.storyContent
                                      ? setSelectedPanel({
                                          title: `${row.id} Story Content`,
                                          kind: "storyContent",
                                          content: row.storyContent,
                                          sources: row.storyContentSources ?? [],
                                        })
                                      : null
                                  }
                                >
                                  <EyeIcon />
                                </IconButton>
                              ) : null}
                              {row.wikiPoi ? (
                                <form
                                  action={(formData) =>
                                    runSingleAction(
                                      row.id,
                                      "Generating Story Content...",
                                      refreshStoryContentAction,
                                      formData,
                                    )
                                  }
                                >
                                  <input type="hidden" name="poiId" value={row.id} />
                                  <input type="hidden" name="aiMode" value={selectedAiMode} />
                                  <input type="hidden" name="aiModel" value={selectedAiModel} />
                                  <SubmitButton
                                    idleLabel={row.storyContent ? "Refresh" : "Generate"}
                                    pendingLabel="Generating..."
                                    confirmMessage={refreshConfirmMessages.storyContent}
                                    icon={
                                      row.storyContent ? <ArrowPathIcon /> : <DocumentTextIcon />
                                    }
                                    tone="primary"
                                    disabled={isRowInProgress}
                                  />
                                </form>
                              ) : null}
                              {row.storyContent ? (
                                <form
                                  action={(formData) =>
                                    runSingleAction(
                                      row.id,
                                      "Deleting Story Content...",
                                      deleteStoryContentAction,
                                      formData,
                                    )
                                  }
                                >
                                  <input type="hidden" name="poiId" value={row.id} />
                                  <SubmitButton
                                    idleLabel="Delete"
                                    pendingLabel="Deleting..."
                                    confirmMessage={deleteConfirmMessages.storyContent}
                                    icon={<TrashIcon />}
                                    tone="danger"
                                    disabled={isRowInProgress}
                                  />
                                </form>
                              ) : null}
                            </div>
                          </CellActions>
                        </div>
                      </td>
                      <td className="min-w-0 py-2 pr-4 pl-3 align-top">
                        <div className="flex min-h-32 min-w-0 items-start gap-3">
                          <MainImageCellPreview artifact={row.mainImageArtifact} />
                          <CellContent
                            title={getMainImageStatus(row.mainImageArtifact)}
                            subtitle={
                              row.mainImageArtifact
                                ? `${row.mainImageArtifact.candidates.length} candidate${
                                    row.mainImageArtifact.candidates.length === 1 ? "" : "s"
                                  }`
                                : undefined
                            }
                            updatedAt={row.mainImageUpdatedAt}
                            generationDuration={row.mainImageGenerationDuration}
                          />
                        </div>
                        <CellActions>
                          {row.mainImageArtifact ? (
                            <div className={actionGroupClassName}>
                              <IconButton
                                type="button"
                                label="View Main Image Candidates"
                                disabled={isVisualizationDisabled}
                                onClick={() =>
                                  row.mainImageArtifact
                                    ? setSelectedPanel({
                                        title: `${row.id} Main Image Candidates`,
                                        kind: "mainImage",
                                        poiId: row.id,
                                        artifact: row.mainImageArtifact,
                                      })
                                    : null
                                }
                              >
                                <EyeIcon />
                              </IconButton>
                              <form
                                action={(formData) =>
                                  runSingleAction(
                                    row.id,
                                    "Generating Main Image Candidates...",
                                    refreshMainImageCandidatesAction,
                                    formData,
                                  )
                                }
                              >
                                <input type="hidden" name="poiId" value={row.id} />
                                <SubmitButton
                                  idleLabel="Refresh"
                                  pendingLabel="Refreshing..."
                                  confirmMessage={refreshConfirmMessages.mainImage}
                                  icon={<ArrowPathIcon />}
                                  tone="primary"
                                  disabled={isRowInProgress}
                                />
                              </form>
                              <form
                                action={(formData) =>
                                  runSingleAction(
                                    row.id,
                                    "Deleting Main Image Candidates...",
                                    deleteMainImageCandidatesAction,
                                    formData,
                                  )
                                }
                              >
                                <input type="hidden" name="poiId" value={row.id} />
                                <SubmitButton
                                  idleLabel="Delete"
                                  pendingLabel="Deleting..."
                                  confirmMessage={deleteConfirmMessages.mainImage}
                                  icon={<TrashIcon />}
                                  tone="danger"
                                  disabled={isRowInProgress}
                                />
                              </form>
                            </div>
                          ) : row.transformedPoi ? (
                            <form
                              action={(formData) =>
                                runSingleAction(
                                  row.id,
                                  "Generating Main Image Candidates...",
                                  refreshMainImageCandidatesAction,
                                  formData,
                                )
                              }
                            >
                              <input type="hidden" name="poiId" value={row.id} />
                              <SubmitButton
                                idleLabel="Generate"
                                pendingLabel="Generating..."
                                confirmMessage={refreshConfirmMessages.mainImage}
                                icon={<PhotoIcon />}
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
            {selectedPanel.kind === "storyContent" ? (
              <StoryContentPreview
                content={selectedPanel.content}
                sources={selectedPanel.sources}
              />
            ) : null}
            {selectedPanel.kind === "mainImage" ? (
              <div className="flex-1 overflow-auto bg-neutral-50 px-5 py-4 text-sm text-black">
                {selectedPanel.artifact.candidates.length === 0 ? (
                  <p className="text-sm text-black/55">No candidates found.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedPanel.artifact.candidates.map((candidate) => {
                      const isSelected =
                        candidate.commonsFileName ===
                        selectedPanel.artifact.selectedCommonsFileName;
                      const isSelectable = isCandidateSelectable(candidate);

                      return (
                        <article
                          key={candidate.commonsFileName}
                          className="overflow-hidden rounded-lg border border-black/10 bg-white"
                        >
                          <a
                            href={candidate.commonsPageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block bg-neutral-100"
                          >
                            <Image
                              src={candidate.thumbnailUrl}
                              alt={candidate.commonsFileName}
                              width={candidate.width ?? 640}
                              height={candidate.height ?? 360}
                              sizes="(min-width: 768px) 448px, 100vw"
                              unoptimized
                              className="h-56 w-full object-contain"
                            />
                          </a>
                          <div className="space-y-2 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              {candidate.isProposed ? (
                                <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                                  Proposed
                                </span>
                              ) : null}
                              {isSelected ? (
                                <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900">
                                  Selected
                                </span>
                              ) : null}
                              {!isSelectable ? (
                                <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-900">
                                  Missing license or attribution
                                </span>
                              ) : null}
                            </div>
                            <p className="font-mono text-xs break-words text-black/75">
                              {candidate.commonsFileName}
                            </p>
                            <dl className="space-y-1 text-xs text-black/65">
                              <div>
                                <dt className="font-semibold text-black">License</dt>
                                <dd>{candidate.license ?? "Missing"}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-black">Attribution</dt>
                                <dd>{candidate.attribution ?? "Missing"}</dd>
                              </div>
                              {candidate.author ? (
                                <div>
                                  <dt className="font-semibold text-black">Author</dt>
                                  <dd>{candidate.author}</dd>
                                </div>
                              ) : null}
                              <div>
                                <dt className="font-semibold text-black">Discovery</dt>
                                <dd>{candidate.discoveredVia}</dd>
                              </div>
                              {candidate.width && candidate.height ? (
                                <div>
                                  <dt className="font-semibold text-black">Size</dt>
                                  <dd>
                                    {candidate.width} x {candidate.height}
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                            <form action={selectMainImageCandidateAction}>
                              <input type="hidden" name="poiId" value={selectedPanel.poiId} />
                              <input
                                type="hidden"
                                name="commonsFileName"
                                value={candidate.commonsFileName}
                              />
                              <SubmitButton
                                idleLabel={isSelected ? "Selected" : "Select"}
                                pendingLabel="Selecting..."
                                tone="primary"
                                disabled={isSelected || !isSelectable}
                              />
                            </form>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
