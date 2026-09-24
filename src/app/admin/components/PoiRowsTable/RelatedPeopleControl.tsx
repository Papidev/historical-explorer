"use client";

import { ArrowPathIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { SubmitButton } from "../SubmitButton";
import { RelatedPeopleDrawer } from "./RelatedPeopleDrawer";
import type { ActionCellProps } from "./RowTypes";

const retryConfirmMessage =
  "Retry resolving only the unresolved People for this Story without regenerating Story Content?";

export const RelatedPeopleControl = ({
  row,
  actions,
  isInProgress,
  runSingleAction,
  selectMainImageCandidateAction,
}: Pick<ActionCellProps, "row" | "actions" | "isInProgress" | "runSingleAction"> & {
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const relatedPeople = row.storyContent?.relatedPeople;
  if (!relatedPeople) {
    return null;
  }

  const unresolvedCount = relatedPeople.filter(({ personId }) => !personId).length;

  return (
    <>
      <div className="mt-2 inline-flex max-w-full items-stretch rounded-md border border-violet-200 bg-violet-50">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setIsDrawerOpen(true)}
          disabled={isInProgress}
          className="inline-flex min-w-0 cursor-pointer flex-wrap items-center gap-1.5 rounded-l-md px-2 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50 [&>*]:pointer-events-none"
        >
          <UserGroupIcon className="size-4" aria-hidden="true" />
          Related People
          <span className="rounded bg-violet-100 px-1.5 tabular-nums">{relatedPeople.length}</span>
          {unresolvedCount ? (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-900">
              {unresolvedCount} unresolved
            </span>
          ) : null}
        </button>
        {unresolvedCount ? (
          <form
            className="flex items-center border-l border-violet-200 px-1"
            action={(formData) => {
              setIsDrawerOpen(false);
              return runSingleAction(
                row.id,
                "Resolving Related People...",
                actions.resolveRelatedPeople,
                formData,
                true,
              );
            }}
          >
            <input type="hidden" name="poiId" value={row.id} />
            <SubmitButton
              idleLabel="Retry unresolved People"
              pendingLabel="Resolving..."
              confirmMessage={retryConfirmMessage}
              icon={<ArrowPathIcon />}
              tone="danger"
              disabled={isInProgress}
            />
          </form>
        ) : null}
      </div>
      {isDrawerOpen ? (
        <RelatedPeopleDrawer
          poiName={row.transformedPoi?.name ?? row.rawPoi?.name ?? row.id}
          people={row.artifacts?.relatedPeople ?? []}
          onClose={() => setIsDrawerOpen(false)}
          selectMainImageCandidateAction={selectMainImageCandidateAction}
        />
      ) : null}
    </>
  );
};
