"use client";

import { useOptimistic, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BatchGeneration } from "./BatchGeneration";
import { Pagination } from "./Pagination";
import { Search } from "./Search";
import type { RefObject } from "react";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminAction, AdminBatchAction, AdminArtifact, AdminPoiRow } from "../../lib/types";
import { getPoiRowStatusGroup } from "../../lib/getPoiRowStatusGroup";
import { ActionToast, getActionError, type Toast } from "../ActionToast";
import { AiProgressDialog } from "./AiProgressDialog";
import { Preview, type SelectedPanel } from "./Preview";
import { Row } from "./Row";
import type { Actions } from "./RowTypes";
import { GlobalArtifacts } from "./GlobalArtifacts";
import { statusGroupStyles } from "./statusGroupStyles";

const ColumnHeader = ({
  title,
  path,
  description,
  versioned,
}: {
  title: string;
  path: string;
  description: string;
  versioned: boolean;
}) => (
  <div>
    <p className="text-xs font-semibold tracking-[0.08em] text-gray-600 uppercase">{title}</p>
    <p
      title={path}
      className="mt-1 max-w-full truncate font-mono text-[0.6875rem] leading-snug text-gray-400 normal-case"
    >
      {path}
    </p>
    <div className="mt-1 text-[0.6875rem] leading-snug normal-case">
      <span
        className={
          versioned
            ? "rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800"
            : "rounded bg-gray-200 px-1.5 py-0.5 font-medium text-gray-600"
        }
      >
        {versioned ? "Versioned" : "Gitignored"}
      </span>
      <p className="mt-1 text-gray-500">{description}</p>
    </div>
  </div>
);

export const PoiRowsTable = ({
  rows,
  globalArtifacts,
  aiSelectionRef,
  generateDraftStoryAction,
  generateDraftStoriesAction,
  refreshStoryContentAction,
  resolveRelatedPeopleAction,
  refreshMainImageCandidatesAction,
  refreshPoiTypesAction,
  selectMainImageCandidateAction,
}: {
  rows: AdminPoiRow[];
  globalArtifacts: AdminArtifact[];
  aiSelectionRef: RefObject<Pick<AiSelection, "mode" | "model">>;
  generateDraftStoryAction: AdminAction;
  generateDraftStoriesAction: AdminBatchAction;
  refreshStoryContentAction: AdminAction;
  resolveRelatedPeopleAction: AdminAction;
  refreshMainImageCandidatesAction: AdminAction;
  refreshPoiTypesAction: AdminAction;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [runningIds, setRunningIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(null);
  const [progress, setProgress] = useOptimistic<{
    poiId: string;
    description: string;
  } | null>(null);
  const [actionToast, setActionToast] = useState<Toast | null>(null);
  const [visibleStatusGroups, setVisibleStatusGroups] = useState<string[]>(
    Object.keys(statusGroupStyles),
  );
  const [aiProgressDialog, setAiProgressDialog] = useState<{
    runId: string;
    title: string;
    isFinished: boolean;
    isOpen: boolean;
  } | null>(null);

  const actions: Actions = {
    generateDraftStory: generateDraftStoryAction,
    refreshStoryContent: refreshStoryContentAction,
    resolveRelatedPeople: resolveRelatedPeopleAction,
    refreshMainImageCandidates: refreshMainImageCandidatesAction,
    refreshPoiTypes: refreshPoiTypesAction,
  };
  const searchText = search.trim().toLocaleLowerCase("en");
  const runningRows = runningIds.flatMap((id) =>
    rows.filter((row) => (row.rawPoi?.id ?? row.id) === id),
  );
  const visibleRows = rows.filter(
    (row) =>
      !runningIds.includes(row.rawPoi?.id ?? row.id) &&
      visibleStatusGroups.includes(getPoiRowStatusGroup(row)) &&
      (!searchText ||
        [row.rawPoi?.name, row.transformedPoi?.name].some((name) =>
          name?.toLocaleLowerCase("en").includes(searchText),
        )),
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visibleRows.length / 50) - 1));

  const runSingleAction = async (
    poiId: string,
    description: string,
    action: AdminAction,
    formData: FormData,
    includeAiSelection = false,
  ) => {
    if (runningIds.length) return;
    const runId = includeAiSelection ? crypto.randomUUID() : undefined;
    if (includeAiSelection) {
      formData.set("aiMode", aiSelectionRef.current.mode);
      formData.set("aiModel", aiSelectionRef.current.model);
    }
    if (runId) {
      formData.set("progressId", runId);
      flushSync(() => {
        setAiProgressDialog({
          runId,
          title: description.replace(/\.\.\.$/, ""),
          isFinished: false,
          isOpen: true,
        });
      });
    }
    setSelectedPanel(null);
    setActionToast(null);
    setProgress({ poiId, description });
    try {
      const result = await action(formData);
      if (result?.warning) {
        setActionToast({ tone: "warning", ...result.warning });
      }
      if (runId) {
        setAiProgressDialog((current) =>
          current?.runId === runId
            ? { ...current, isFinished: true, isOpen: current.isOpen && Boolean(result?.warning) }
            : current,
        );
      }
    } catch (error) {
      setActionToast(getActionError(error));
      if (runId) {
        setAiProgressDialog((current) =>
          current?.runId === runId ? { ...current, isFinished: true } : current,
        );
      }
    }
  };

  return (
    <>
      {aiProgressDialog?.isOpen ? (
        <AiProgressDialog
          key={aiProgressDialog.runId}
          runId={aiProgressDialog.runId}
          title={aiProgressDialog.title}
          isFinished={aiProgressDialog.isFinished}
          onClose={() =>
            setAiProgressDialog((current) => (current ? { ...current, isOpen: false } : current))
          }
        />
      ) : null}
      {actionToast ? (
        <ActionToast toast={actionToast} onDismiss={() => setActionToast(null)} />
      ) : null}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-950/10">
        <GlobalArtifacts artifacts={globalArtifacts} onSelectPanel={setSelectedPanel} />
        <BatchGeneration
          rows={visibleRows
            .filter((row) => row.rawPoi && getPoiRowStatusGroup(row) === "to-do")
            .slice(0, 3)}
          aiSelectionRef={aiSelectionRef}
          action={generateDraftStoriesAction}
          disabled={Boolean(progress) || runningIds.length > 0}
          onRunningChange={(ids) => {
            setRunningIds(ids);
            if (ids.length) tableScrollRef.current?.scrollTo?.({ top: 0 });
          }}
          onShowLog={(runId, title, isFinished) =>
            setAiProgressDialog({ runId, title, isFinished, isOpen: true })
          }
        />
        <div
          role="group"
          aria-label="Show status"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-gray-200 px-4 py-3 text-sm"
        >
          <Search
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(0);
            }}
          />
          <span className="font-semibold text-gray-800">Show status</span>
          {Object.entries(statusGroupStyles).map(([value, { label, filter, checkbox }]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 ${filter} ${
                visibleStatusGroups.includes(value) ? "" : "opacity-55 hover:opacity-100"
              }`}
            >
              <input
                type="checkbox"
                checked={visibleStatusGroups.includes(value)}
                onChange={(event) => {
                  setPage(0);
                  setVisibleStatusGroups((current) =>
                    event.target.checked
                      ? [...current, value]
                      : current.filter((group) => group !== value),
                  );
                }}
                className={`size-4 cursor-pointer ${checkbox}`}
              />
              {label}
            </label>
          ))}
        </div>
        <div
          ref={tableScrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-auto [&_[role=tooltip]]:right-0 [&_[role=tooltip]]:left-auto [&_[role=tooltip]]:translate-x-0"
        >
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-black/55">No POIs available.</p>
          ) : visibleRows.length === 0 && runningRows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-black/55">
              {searchText
                ? "No POIs match the search and selected statuses."
                : "No POIs match the selected statuses."}
            </p>
          ) : (
            <table className="w-full table-fixed divide-y divide-gray-300">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-amber-50">
                <tr>
                  <th
                    scope="col"
                    className="border-r border-b border-gray-200 py-2 pr-3 pl-4 text-left align-top"
                  >
                    <ColumnHeader
                      title="Geo Place"
                      path="data/rome/pois/raw.geojson"
                      description="Source input"
                      versioned
                    />
                  </th>
                  <th
                    scope="col"
                    className="border-r border-b border-gray-200 px-3 py-2 text-left align-top"
                  >
                    <ColumnHeader
                      title="POI"
                      path="data/rome/pois/pois.geojson"
                      description="Generated catalog entry"
                      versioned
                    />
                  </th>
                  <th
                    scope="col"
                    className="border-r border-b border-gray-200 px-3 py-2 text-left align-top"
                  >
                    <ColumnHeader
                      title="Wikipedia Text"
                      path="data/rome/generated/wikipedia/*.txt"
                      description="Local snapshot; overwritten with each Story generation"
                      versioned={false}
                    />
                  </th>
                  <th
                    scope="col"
                    className="border-r border-b border-gray-200 px-3 py-2 text-left align-top"
                  >
                    <ColumnHeader
                      title="Wikidata Types"
                      path="data/rome/generated/wikidata/*.json"
                      description="Source types for future filters"
                      versioned={false}
                    />
                  </th>
                  <th
                    scope="col"
                    className="border-r border-b border-gray-200 px-3 py-2 text-left align-top"
                  >
                    <ColumnHeader
                      title="Story"
                      path="data/rome/stories/<poi-id>/story.json"
                      description="View opens an editorial preview"
                      versioned
                    />
                  </th>
                  <th
                    scope="col"
                    className="border-b border-gray-200 py-2 pr-4 pl-3 text-left align-top"
                  >
                    <ColumnHeader
                      title="Main Image"
                      path="data/rome/stories/<poi-id>/images.json"
                      description="Candidate list; Select changes the chosen image"
                      versioned
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {[
                  ...runningRows,
                  ...visibleRows.slice(currentPage * 50, (currentPage + 1) * 50),
                ].map((row) => (
                  <Row
                    key={row.rawPoi?.id ?? row.id}
                    row={row}
                    actions={actions}
                    actionsDisabled={runningIds.length > 0}
                    isInProgress={
                      progress?.poiId === row.id || runningIds.includes(row.rawPoi?.id ?? row.id)
                    }
                    progressDescription={
                      runningIds.includes(row.rawPoi?.id ?? row.id)
                        ? "Generating Draft Story..."
                        : progress && progress.poiId === row.id
                          ? progress.description
                          : null
                    }
                    onSelectPanel={setSelectedPanel}
                    runSingleAction={runSingleAction}
                    selectMainImageCandidateAction={selectMainImageCandidateAction}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
        {visibleRows.length > 0 ? (
          <Pagination page={currentPage} totalRows={visibleRows.length} onPageChange={setPage} />
        ) : null}
      </section>
      {selectedPanel ? (
        <Preview
          panel={selectedPanel}
          onClose={() => setSelectedPanel(null)}
          selectMainImageCandidateAction={selectMainImageCandidateAction}
        />
      ) : null}
    </>
  );
};
