import { useState } from "react";
import { flushSync } from "react-dom";
import type { RefObject } from "react";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminBatchAction, AdminBatchResult, AdminPoiRow } from "../../lib/types";
import { getActionError } from "../ActionToast";

export const useBatchGeneration = ({
  rows,
  aiSelectionRef,
  action,
  disabled,
  onRunningChange,
}: {
  rows: AdminPoiRow[];
  aiSelectionRef: RefObject<Pick<AiSelection, "mode" | "model">>;
  action: AdminBatchAction;
  disabled: boolean;
  onRunningChange: (ids: string[]) => void;
}) => {
  const [runs, setRuns] = useState<Array<AdminBatchResult & { name: string; isFinished: boolean }>>(
    [],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return {
    runs,
    error,
    isOpen,
    setIsOpen,
    generate: async () => {
      const selected = rows.flatMap((row) =>
        row.rawPoi
          ? [
              {
                geoPlaceId: row.rawPoi.id,
                name: row.rawPoi.name,
                progressId: crypto.randomUUID(),
                isFinished: false,
              },
            ]
          : [],
      );
      if (!selected.length || selected.length > 3 || disabled) return;
      flushSync(() => {
        setRuns(selected);
        setIsOpen(true);
        setError(null);
        onRunningChange(selected.map(({ geoPlaceId }) => geoPlaceId));
      });
      const formData = new FormData();
      formData.set("aiMode", aiSelectionRef.current.mode);
      formData.set("aiModel", aiSelectionRef.current.model);
      for (const run of selected) {
        formData.append("geoPlaceId", run.geoPlaceId);
        formData.append("progressId", run.progressId);
      }
      try {
        const results = await action(formData);
        setRuns(
          selected.map((run) => ({
            ...run,
            ...results.find(({ progressId }) => progressId === run.progressId),
            isFinished: true,
          })),
        );
      } catch (error) {
        setError(getActionError(error).title);
        setRuns(selected.map((run) => ({ ...run, error: "Batch failed", isFinished: true })));
      } finally {
        onRunningChange([]);
      }
    },
  };
};
