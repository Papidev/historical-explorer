"use client";

import { useOptimistic, useState } from "react";
import type { RefObject } from "react";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminAction, AdminArtifact, AdminPoiRow } from "../../lib/types";
import { ActionToast, getActionError, type Toast } from "../ActionToast";
import { Preview, type SelectedPanel } from "./Preview";
import { Row } from "./Row";
import type { Actions } from "./RowTypes";
import { RelatedPeopleDrawer } from "./RelatedPeopleDrawer";
import { GlobalArtifacts } from "./GlobalArtifacts";

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
  refreshStoryContentAction,
  resolveRelatedPeopleAction,
  refreshMainImageCandidatesAction,
  selectMainImageCandidateAction,
}: {
  rows: AdminPoiRow[];
  globalArtifacts: AdminArtifact[];
  aiSelectionRef: RefObject<Pick<AiSelection, "mode" | "model">>;
  generateDraftStoryAction: AdminAction;
  refreshStoryContentAction: AdminAction;
  resolveRelatedPeopleAction: AdminAction;
  refreshMainImageCandidatesAction: AdminAction;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const [relatedPeoplePoiId, setRelatedPeoplePoiId] = useState<string | null>(null);
  const relatedPeopleRow = rows.find((row) => row.id === relatedPeoplePoiId);
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(null);
  const [progress, setProgress] = useOptimistic<{
    poiId: string;
    description: string;
  } | null>(null);
  const [actionToast, setActionToast] = useState<Toast | null>(null);

  const actions: Actions = {
    generateDraftStory: generateDraftStoryAction,
    refreshStoryContent: refreshStoryContentAction,
    resolveRelatedPeople: resolveRelatedPeopleAction,
    refreshMainImageCandidates: refreshMainImageCandidatesAction,
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
    setRelatedPeoplePoiId(null);
    setActionToast(null);
    setProgress({ poiId, description });
    try {
      const result = await action(formData);
      if (result?.warning) {
        setActionToast({ tone: "warning", ...result.warning });
      }
    } catch (error) {
      setActionToast(getActionError(error));
    }
  };

  return (
    <>
      {actionToast ? (
        <ActionToast toast={actionToast} onDismiss={() => setActionToast(null)} />
      ) : null}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-950/10">
        <GlobalArtifacts artifacts={globalArtifacts} onSelectPanel={setSelectedPanel} />
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-sm text-black/55">No POIs available.</p>
          ) : (
            <table className="w-full table-fixed divide-y divide-gray-300">
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
                      path="data/rome/generated/wiki/*.txt"
                      description="Local snapshot; overwritten with each Story generation"
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
                    onViewRelatedPeople={setRelatedPeoplePoiId}
                    runSingleAction={runSingleAction}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      {relatedPeopleRow ? (
        <RelatedPeopleDrawer
          poiName={
            relatedPeopleRow.transformedPoi?.name ??
            relatedPeopleRow.rawPoi?.name ??
            relatedPeopleRow.id
          }
          people={relatedPeopleRow.artifacts?.relatedPeople ?? []}
          onClose={() => setRelatedPeoplePoiId(null)}
          selectMainImageCandidateAction={selectMainImageCandidateAction}
        />
      ) : null}
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
