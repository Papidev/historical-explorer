import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { IconButton } from "@/app/components/ui/IconButton";
import type { RelatedPersonArtifacts } from "../../lib/types";
import { ArtifactViewButton } from "./ArtifactViewButton";
import { Preview, type SelectedPanel } from "./Preview";

export const RelatedPeopleDrawer = ({
  poiName,
  people,
  onClose,
  selectMainImageCandidateAction,
}: {
  poiName: string;
  people: RelatedPersonArtifacts[];
  onClose: () => void;
  selectMainImageCandidateAction: (formData: FormData) => Promise<void>;
}) => {
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(null);

  return (
    <Dialog open onClose={onClose} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-black/25" />
      <div className="fixed inset-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 right-0 flex max-w-full pl-6">
          <DialogPanel className="pointer-events-auto flex h-full w-screen max-w-md flex-col bg-white shadow-xl [&_[role=tooltip]]:right-0 [&_[role=tooltip]]:left-auto [&_[role=tooltip]]:translate-x-0">
            <div className="border-b border-violet-200 bg-violet-50 px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold text-violet-900">
                    Related People
                  </DialogTitle>
                  <p className="mt-1 text-sm break-words text-black/65">{poiName}</p>
                </div>
                <IconButton label="Close Related People" onClick={onClose}>
                  <XMarkIcon />
                </IconButton>
              </div>
              <p className="mt-4 text-xs text-black/55">
                {people.filter((person) => person.personId).length} resolved ·{" "}
                {people.filter((person) => !person.personId).length} unresolved
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {people.length === 0 ? (
                <p className="py-6 text-sm text-black/55">This Story has no related people.</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {people.map((person, index) => (
                    <li key={`${person.name}-${index}`} className="py-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 text-sm font-semibold break-words text-violet-900">
                          {person.name}
                        </h3>
                        <span
                          className={
                            person.personId
                              ? "shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800"
                              : "shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-900"
                          }
                        >
                          {person.personId ? "Resolved" : "Unresolved"}
                        </span>
                      </div>
                      {person.personId ? (
                        <>
                          <p className="mt-1 font-mono text-xs break-all text-black/55">
                            {person.personId}
                          </p>
                          <ul className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
                            {person.artifacts.map((artifact) => (
                              <li
                                key={artifact.path}
                                className="flex items-center justify-between gap-4"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-black/75">
                                    {artifact.versioned ? "Person JSON" : "Wikipedia Text"}
                                  </p>
                                  <span
                                    className={
                                      artifact.versioned
                                        ? "mt-1 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[0.6875rem] font-medium text-sky-800"
                                        : "mt-1 inline-block rounded bg-gray-200 px-1.5 py-0.5 text-[0.6875rem] font-medium text-gray-600"
                                    }
                                  >
                                    {artifact.versioned ? "Versioned" : "Gitignored"}
                                  </span>
                                </div>
                                <ArtifactViewButton
                                  artifact={artifact}
                                  onSelectPanel={setSelectedPanel}
                                />
                              </li>
                            ))}
                            {person.artifacts.length === 0 ? (
                              <li className="text-xs text-black/55">
                                No local artifacts available.
                              </li>
                            ) : null}
                          </ul>
                        </>
                      ) : (
                        <div className="mt-3 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-950">
                          {person.resolutionError ? (
                            <>
                              <p className="font-semibold">Resolution error</p>
                              <p className="mt-1 break-words">{person.resolutionError}</p>
                            </>
                          ) : (
                            <p>
                              No resolution error was saved for this earlier attempt. Retry Resolve
                              People to capture the cause.
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedPanel ? (
              <Preview
                panel={selectedPanel}
                onClose={() => setSelectedPanel(null)}
                selectMainImageCandidateAction={selectMainImageCandidateAction}
              />
            ) : null}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};
