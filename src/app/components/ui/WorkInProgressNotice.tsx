import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

export const WorkInProgressNotice = () => (
  <aside
    aria-label="Development status"
    className="shrink-0 border-b border-yellow-400 bg-yellow-100 px-4 py-3 text-zinc-900 sm:px-6"
  >
    <div className="mx-auto flex max-w-7xl items-start justify-center gap-2.5 text-sm">
      <WrenchScrewdriverIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <strong className="font-semibold">Work in progress.</strong> Mira is still being built.
        Content and features may be incomplete or change.
      </p>
    </div>
  </aside>
);
