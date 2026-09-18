"use client";

import { ArrowPathIcon, EyeIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import { IconButton } from "@/app/components/ui/IconButton";
import type { PersonProfile } from "@/server/personProfile";
import type { AiMode, AiModel } from "../lib/aiModels";
import { SubmitButton } from "./SubmitButton";

export const PeopleTable = ({
  people,
  selectedAiMode,
  selectedAiModel,
  regenerateAction,
}: {
  people: PersonProfile[];
  selectedAiMode: AiMode;
  selectedAiModel: AiModel;
  regenerateAction: (formData: FormData) => Promise<void>;
}) => {
  const [selected, setSelected] = useState<PersonProfile>();

  return (
    <section className="mb-4 shrink-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-950/10">
      <div className="border-b border-gray-200 bg-sky-50 px-4 py-2">
        <h2 className="text-sm font-semibold text-black">People</h2>
        <p className="text-xs text-black/55">Global profiles generated from Story references.</p>
      </div>
      {people.length === 0 ? (
        <p className="px-4 py-3 text-sm text-black/55">No people generated yet.</p>
      ) : (
        <div className="max-h-48 overflow-auto">
          <table className="w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs text-gray-500 uppercase">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Person ID</th><th className="px-4 py-2">Wikidata</th><th className="px-4 py-2">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {people.map((person) => (
                <tr key={person.id}>
                  <td className="px-4 py-2 font-semibold">{person.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{person.id}</td>
                  <td className="px-4 py-2 font-mono text-xs">{person.wikidataId}</td>
                  <td className="flex items-center gap-2 px-4 py-2">
                    <IconButton type="button" label={`View ${person.name}`} onClick={() => setSelected(person)}><EyeIcon /></IconButton>
                    <form action={regenerateAction}>
                      <input type="hidden" name="personId" value={person.id} />
                      <input type="hidden" name="aiMode" value={selectedAiMode} />
                      <input type="hidden" name="aiModel" value={selectedAiModel} />
                      <SubmitButton idleLabel="Regenerate" pendingLabel="Regenerating..." icon={<ArrowPathIcon />} tone="primary" />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6">
          <div className="flex max-h-[80vh] w-[min(760px,100%)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <p className="font-semibold">{selected.name}</p>
              <button type="button" onClick={() => setSelected(undefined)} className="cursor-pointer rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium">Close</button>
            </div>
            <pre className="overflow-auto bg-neutral-50 p-5 text-xs whitespace-pre-wrap">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </section>
  );
};
