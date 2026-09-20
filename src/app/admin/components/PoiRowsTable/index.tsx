"use client";

import { useState } from "react";
import type { RefObject } from "react";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminAction, AdminPoiRow } from "../../lib/types";
import { ActionToast, getActionError, type Toast } from "../ActionToast";
import { Preview, type SelectedPanel } from "./Preview";
import { Row, type Actions } from "./Row";

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

export const PoiRowsTable = ({
  rows,
  aiSelectionRef,
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
  aiSelectionRef: RefObject<Pick<AiSelection, "mode" | "model">>;
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
  const [progress, setProgress] = useState<{ poiId: string; description: string } | null>(null);
  const [actionToast, setActionToast] = useState<Toast | null>(null);

  const actions: Actions = {
    generateDraftStory: generateDraftStoryAction,
    resetDraftStory: resetDraftStoryAction,
    refreshStoryContent: refreshStoryContentAction,
    resolveRelatedPeople: resolveRelatedPeopleAction,
    deleteStoryContent: deleteStoryContentAction,
    refreshMainImageCandidates: refreshMainImageCandidatesAction,
    deleteMainImageCandidates: deleteMainImageCandidatesAction,
  };

  const runSingleAction = async (
    poiId: string,
    description: string,
    action: AdminAction,
    formData: FormData,
    includeAiSelection = false,
  ) => {
    if (includeAiSelection) {
      formData.set("aiMode", aiSelectionRef.current.mode);
      formData.set("aiModel", aiSelectionRef.current.model);
    }
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
                {rows.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    actions={actions}
                    isInProgress={progress?.poiId === row.id}
                    progressDescription={
                      progress && progress.poiId === row.id ? progress.description : null
                    }
                    onSelectPanel={setSelectedPanel}
                    runSingleAction={runSingleAction}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
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
