import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Person } from "@/app/components/Person";
import { IconButton } from "@/app/components/ui/IconButton";
import type { AdminPerson } from "../../lib/types";

export const Detail = ({ person, onClose }: { person: AdminPerson; onClose: () => void }) => (
  <Dialog open onClose={onClose} className="relative z-40">
    <DialogBackdrop className="fixed inset-0 bg-black/25" />
    <div className="fixed inset-0 flex justify-end">
      <DialogPanel className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <DialogTitle className="text-lg font-semibold text-gray-900">{person.name}</DialogTitle>
          <IconButton label="Close Person" onClick={onClose}>
            <XMarkIcon />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section
            aria-labelledby="linked-pois-heading"
            className="mb-6 rounded-lg border border-violet-200 bg-violet-50 p-4"
          >
            <h2 id="linked-pois-heading" className="text-sm font-semibold text-violet-900">
              Linked POIs ({person.linkedPois.length})
            </h2>
            {person.linkedPois.length ? (
              <ul className="mt-3 divide-y divide-violet-200">
                {person.linkedPois.map((poi) => (
                  <li key={poi.id} className="py-2 text-sm text-violet-900">
                    {poi.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                This Person is not linked to any POIs yet.
              </p>
            )}
          </section>
          <Person person={person} />
        </div>
      </DialogPanel>
    </div>
  </Dialog>
);
