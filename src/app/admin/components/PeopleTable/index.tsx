"use client";

import { useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { UserIcon } from "@heroicons/react/24/outline";
import type { AiSelection } from "../../lib/aiModels";
import type { AdminAction, AdminPerson } from "../../lib/types";
import { ActionToast, getActionError, type Toast } from "../ActionToast";
import { SubmitButton } from "../SubmitButton";
import { AiProgressDialog } from "../PoiRowsTable/AiProgressDialog";
import { Detail } from "./Detail";

export const PeopleTable = ({
  people,
  aiSelectionRef,
  regeneratePersonAction,
}: {
  people: AdminPerson[];
  aiSelectionRef: RefObject<AiSelection>;
  regeneratePersonAction: AdminAction;
}) => {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const isRunningRef = useRef(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [progress, setProgress] = useState<{
    runId: string;
    title: string;
    isFinished: boolean;
    isOpen: boolean;
  } | null>(null);
  const filteredPeople = people.filter(({ name }) =>
    name.toLocaleLowerCase("en").includes(search.trim().toLocaleLowerCase("en")),
  );
  const selectedPerson = people.find(({ id }) => id === selectedId);

  return (
    <section
      aria-label="Generated People"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
        <p className="text-sm text-gray-600" aria-live="polite">
          {filteredPeople.length} of {people.length} generated People
        </p>
        <label>
          <span className="sr-only">Search People by name</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search People by name"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-2 focus:outline-indigo-600 sm:w-64"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-gray-50 text-xs text-gray-600 uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">
                Image
              </th>
              <th scope="col" className="px-4 py-3">
                Person
              </th>
              <th scope="col" className="px-4 py-3">
                Description
              </th>
              <th scope="col" className="px-4 py-3">
                Linked POIs
              </th>
              <th scope="col" className="px-4 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPeople.map((person) => (
              <tr key={person.id}>
                <td className="px-4 py-3">
                  {person.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- People thumbnails use runtime-selected Wikimedia URLs. */
                    <img
                      src={person.image.thumbnailUrl}
                      alt={person.name}
                      loading="lazy"
                      className="size-16 rounded-md bg-gray-100 object-contain"
                    />
                  ) : (
                    <span
                      className="flex size-16 items-center justify-center rounded-md bg-gray-100 text-gray-400"
                      aria-label="No image available"
                    >
                      <UserIcon className="size-8" aria-hidden="true" />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(person.id)}
                    aria-haspopup="dialog"
                    className="cursor-pointer text-left font-semibold text-violet-700 hover:underline"
                  >
                    {person.name}
                  </button>
                  <p className="mt-1 font-mono text-xs text-gray-500">{person.id}</p>
                </td>
                <td className="max-w-xl px-4 py-3 text-gray-600">
                  <p className="line-clamp-3">{person.description[0]}</p>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(person.id)}
                    aria-haspopup="dialog"
                    aria-label={`View ${person.linkedPois.length} linked POIs for ${person.name}`}
                    className="cursor-pointer rounded-full bg-violet-50 px-3 py-1 font-semibold text-violet-700 tabular-nums hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-700"
                  >
                    {person.linkedPois.length}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <form
                    action={async (formData) => {
                      if (isRunningRef.current) return;
                      isRunningRef.current = true;
                      const runId = crypto.randomUUID();
                      formData.set("aiMode", aiSelectionRef.current.mode);
                      formData.set("aiModel", aiSelectionRef.current.model);
                      formData.set("progressId", runId);
                      flushSync(() => {
                        setRunningId(person.id);
                        setToast(null);
                        setProgress({
                          runId,
                          title: `Regenerating ${person.name}`,
                          isFinished: false,
                          isOpen: true,
                        });
                      });
                      try {
                        await regeneratePersonAction(formData);
                        setProgress((current) =>
                          current ? { ...current, isFinished: true, isOpen: false } : null,
                        );
                      } catch (error) {
                        setToast(getActionError(error));
                        setProgress((current) =>
                          current ? { ...current, isFinished: true } : null,
                        );
                      } finally {
                        isRunningRef.current = false;
                        setRunningId(null);
                      }
                    }}
                  >
                    <input type="hidden" name="personId" value={person.id} />
                    <SubmitButton
                      idleLabel="Regenerate"
                      pendingLabel="Regenerating..."
                      disabled={runningId !== null}
                      confirmMessage={`Regenerate ${person.name} using the saved Wikipedia source and selected AI model? This replaces the description, curiosities, and dates for every Story that links to this Person.`}
                    />
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPeople.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            {people.length ? "No People match your search." : "No People have been generated yet."}
          </p>
        ) : null}
      </div>
      {selectedPerson ? (
        <Detail person={selectedPerson} onClose={() => setSelectedId(null)} />
      ) : null}
      {toast ? <ActionToast toast={toast} onDismiss={() => setToast(null)} /> : null}
      {progress?.isOpen ? (
        <AiProgressDialog
          runId={progress.runId}
          title={progress.title}
          isFinished={progress.isFinished}
          onClose={() => setProgress((current) => (current ? { ...current, isOpen: false } : null))}
        />
      ) : null}
    </section>
  );
};
