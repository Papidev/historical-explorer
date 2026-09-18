"use client";

import {
  ArrowPathIcon,
  DocumentTextIcon,
  EyeIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/20/solid";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { IconButton } from "@/app/components/ui/IconButton";
import type { Source, StoryContent } from "@/server/storyWorkflow";
import type { AiMode, AiModel } from "../lib/aiModels";
import type {
  AdminAction,
  AdminActionWarning,
  AdminPoiRow,
  MainImageCandidate,
  MainImageCandidatesArtifact,
} from "../lib/types";
import { SubmitButton } from "./SubmitButton";

const refreshConfirmMessages = {
  storyContent: "Refresh Story Content for this POI?",
  relatedPeople:
    "Retry resolving only the unresolved People for this Story without regenerating Story Content?",
  mainImage: "Refresh Main Image Candidates for this POI?",
} as const;

const generateConfirmMessage = "Generate a Point of Interest and Draft Story for this Geo Place?";

type ProgressState = {
  poiId: string;
  description: string;
};

type ActionToast = AdminActionWarning & { tone: "error" | "warning" };

const getActionError = (error: unknown): ActionToast => {
  const details = error instanceof Error ? error.message : "The action failed. Please try again.";

  if (/\b429\b|too many requests/i.test(details)) {
    return {
      tone: "error",
      title: "Service temporarily unavailable",
      description: "An external service rate limit was reached. Wait a few minutes and try again.",
      details,
    };
  }
  if (details.includes("sources-unavailable")) {
    return {
      tone: "error",
      title: "Source acquisition failed",
      description: "A usable Wikipedia source could not be retrieved for this POI.",
      details,
    };
  }
  if (details.includes("story-content-generation-failed") || details.includes("ZodError")) {
    return {
      tone: "error",
      title: "Content generation failed",
      description: "The AI-generated Story or Person content could not be generated or validated.",
      details,
    };
  }
  if (details.includes("main-image-candidates-generation-failed")) {
    return {
      tone: "error",
      title: "Image generation failed",
      description: "Wikimedia image candidates could not be retrieved or processed.",
      details,
    };
  }
  if (details.includes("persistence-failed")) {
    return {
      tone: "error",
      title: "Save failed",
      description: "The generated content could not be saved safely.",
      details,
    };
  }
  if (details.includes("point-of-interest-not-found")) {
    return {
      tone: "error",
      title: "POI not found",
      description: "The requested Point of Interest is no longer available.",
      details,
    };
  }

  return {
    tone: "error",
    title: "Action failed",
    description: "An unexpected error interrupted the requested action.",
    details,
  };
};

const deleteConfirmMessages = {
  transformed:
    "Reset this row? This deletes generated POI, Wikipedia Text, Story, and Main Image Candidates for this POI.",
  storyContent: "Delete Story Content for this POI?",
  mainImage: "Delete Main Image Candidates for this POI?",
} as const;

const actionGroupClassName = "flex flex-wrap items-center gap-1.5";
const cellLayoutClassName = "flex h-full min-h-32 min-w-0 flex-col";

const CellContent = ({
  title,
  subtitle,
  generationModel,
  isAvailable = false,
  titleTone = "status",
}: {
  title?: string;
  subtitle?: string;
  generationModel?: string;
  isAvailable?: boolean;
  titleTone?: "poi" | "status";
}) => (
  <div className="grid min-w-0 grid-rows-[2.5rem_1rem]">
    <div className="overflow-hidden">
      {title || !isAvailable ? (
        <p
          className={`line-clamp-2 break-words ${
            title
              ? titleTone === "poi"
                ? "text-base leading-5 font-semibold text-black"
                : "text-xs leading-4 font-semibold text-emerald-700"
              : "text-sm leading-5 text-black/35"
          }`}
        >
          {title ?? "Not generated"}
        </p>
      ) : null}
    </div>
    <div className="overflow-hidden">
      {subtitle ? (
        <p className="truncate font-mono text-xs leading-4 text-black/65" title={subtitle}>
          {subtitle}
        </p>
      ) : generationModel ? (
        <p className="truncate text-xs leading-4 text-black/55" title={`Model: ${generationModel}`}>
          Model: <span className="font-bold">{generationModel}</span>
        </p>
      ) : null}
    </div>
  </div>
);

const CellFooter = ({
  children,
  updatedAt,
  generationDuration,
}: {
  children?: ReactNode;
  updatedAt?: string;
  generationDuration?: string;
}) =>
  updatedAt || generationDuration || children ? (
    <div className="mt-auto flex items-end justify-between gap-2 pt-3">
      <div className="min-w-0 text-[0.6875rem] leading-4 text-black/55">
        {updatedAt ? (
          <p className="truncate" title={`Updated: ${updatedAt}`}>
            Updated: <span className="font-bold">{updatedAt}</span>
          </p>
        ) : null}
        {generationDuration ? (
          <p className="truncate" title={`Generated: ${generationDuration}`}>
            Generated: <span className="font-bold">{generationDuration}</span>
          </p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  ) : null;

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

const ActionToast = ({ toast, onDismiss }: { toast: ActionToast; onDismiss: () => void }) => {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 12_000);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  const isWarning = toast.tone === "warning";

  return (
    <div
      role="alert"
      className={`fixed right-4 bottom-4 z-50 flex max-w-md items-start gap-4 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg ring-1 ring-black/5 ${
        isWarning ? "border-amber-200 text-amber-900" : "border-red-200 text-red-800"
      }`}
    >
      <div className="flex-1">
        <p className="font-semibold">{toast.title}</p>
        <p className="mt-0.5 opacity-80">{toast.description}</p>
        <p className="mt-1 font-mono text-xs break-words opacity-75">{toast.details}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        className={`-m-1 cursor-pointer rounded p-1 ${
          isWarning
            ? "text-amber-800/70 hover:bg-amber-50 hover:text-amber-950"
            : "text-red-700/70 hover:bg-red-50 hover:text-red-900"
        }`}
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
    return undefined;
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
            <article key={person.name} className="rounded-lg border border-black/10 bg-white p-3">
              <p className="font-semibold">{person.name}</p>
              <p className="font-mono text-xs text-black/55">
                {person.personId ?? "Unresolved"}
              </p>
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
  resolveRelatedPeopleAction,
  deleteStoryContentAction,
  refreshMainImageCandidatesAction,
  deleteMainImageCandidatesAction,
  selectMainImageCandidateAction,
}: {
  rows: AdminPoiRow[];
  selectedAiMode: AiMode;
  selectedAiModel: AiModel;
  generateDraftStoryAction: AdminAction;
  resetDraftStoryAction: AdminAction;
  refreshStoryContentAction: AdminAction;
  resolveRelatedPeopleAction: AdminAction;
  deleteStoryContentAction: AdminAction;
  refreshMainImageCandidatesAction: AdminAction;
  deleteMainImageCandidatesAction: AdminAction;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [actionToast, setActionToast] = useState<ActionToast | null>(null);

  const runSingleAction = async (
    poiId: string,
    description: string,
    action: AdminAction,
    formData: FormData,
  ) => {
    setSelectedPanel(null);
    setActionToast(null);
    setProgress({ poiId, description });
    try {
      const result = await action(formData);
      if (result?.warning) {
        setActionToast({ tone: "warning", ...result.warning });
      }
    } catch (error) {
      setActionToast(getActionError(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      {actionToast ? (
        <ActionToast toast={actionToast} onDismiss={() => setActionToast(null)} />
      ) : null}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-950/10">
        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-black/55">No POIs available.</p>
          ) : (
            <table className="min-w-[1600px] table-fixed divide-y divide-gray-300">
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
                      <td className="h-px min-w-0 border-r border-gray-100 py-2 pr-3 pl-4 align-top">
                        <div className={cellLayoutClassName}>
                          <CellContent
                            title={row.rawPoi?.name}
                            subtitle={row.rawPoi?.wikidata ?? row.rawPoi?.id}
                            titleTone="poi"
                          />
                          {progressDescription ? (
                            <ProgressMessage description={progressDescription} />
                          ) : null}
                          <CellFooter>
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
                          </CellFooter>
                        </div>
                      </td>
                      <td
                        className={`h-px min-w-0 border-r border-gray-100 px-3 py-2 align-top ${
                          row.transformedPoi ? "bg-emerald-50/60" : ""
                        }`}
                      >
                        <div className={cellLayoutClassName}>
                          <CellContent
                            subtitle={row.transformedPoi?.id}
                            isAvailable={Boolean(row.transformedPoi)}
                          />
                          <CellFooter
                            updatedAt={row.transformedUpdatedAt}
                            generationDuration={row.transformedGenerationDuration}
                          >
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
                          </CellFooter>
                        </div>
                      </td>
                      <td
                        className={`h-px min-w-0 border-r border-gray-100 px-3 py-2 align-top ${
                          row.wikiPoi ? "bg-emerald-50/60" : ""
                        }`}
                      >
                        <div className={cellLayoutClassName}>
                          <CellContent isAvailable={Boolean(row.wikiPoi)} />
                          <CellFooter
                            updatedAt={row.wikiUpdatedAt}
                            generationDuration={row.wikiGenerationDuration}
                          >
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
                          </CellFooter>
                        </div>
                      </td>
                      <td
                        className={`h-px min-w-0 border-r border-gray-100 px-3 py-2 align-top ${
                          row.storyContent ? "bg-emerald-50/60" : ""
                        }`}
                      >
                        <div className={cellLayoutClassName}>
                          <CellContent
                            generationModel={[
                              row.storyContentGenerationMode,
                              row.storyContentGenerationProvider,
                              row.storyContentGenerationModel,
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                            isAvailable={Boolean(row.storyContent)}
                          />
                          <CellFooter
                            updatedAt={row.storyContentUpdatedAt}
                            generationDuration={row.storyContentGenerationDuration}
                          >
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
                              {row.storyContent?.relatedPeople.some(({ personId }) => !personId) ? (
                                <form
                                  action={(formData) =>
                                    runSingleAction(
                                      row.id,
                                      "Resolving Related People...",
                                      resolveRelatedPeopleAction,
                                      formData,
                                    )
                                  }
                                >
                                  <input type="hidden" name="poiId" value={row.id} />
                                  <input type="hidden" name="aiMode" value={selectedAiMode} />
                                  <input type="hidden" name="aiModel" value={selectedAiModel} />
                                  <SubmitButton
                                    idleLabel="Resolve People"
                                    pendingLabel="Resolving..."
                                    confirmMessage={refreshConfirmMessages.relatedPeople}
                                    icon={<UserGroupIcon />}
                                    tone="secondary"
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
                          </CellFooter>
                        </div>
                      </td>
                      <td
                        className={`h-px min-w-0 py-2 pr-4 pl-3 align-top ${
                          getSelectedMainImageCandidate(row.mainImageArtifact)
                            ? "bg-emerald-50/60"
                            : ""
                        }`}
                      >
                        <div className={cellLayoutClassName}>
                          <div className="flex min-w-0 items-start gap-3">
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
                              isAvailable={Boolean(
                                getSelectedMainImageCandidate(row.mainImageArtifact),
                              )}
                            />
                          </div>
                          <CellFooter
                            updatedAt={row.mainImageUpdatedAt}
                            generationDuration={row.mainImageGenerationDuration}
                          >
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
                          </CellFooter>
                        </div>
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
                className="inline-flex cursor-pointer items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03]"
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
