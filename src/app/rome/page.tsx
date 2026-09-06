import { MapPinIcon } from "@heroicons/react/24/outline";
import { RomeMap } from "@/app/components/RomeMap";
import { WorkInProgressBadge } from "@/app/components/ui/WorkInProgressBadge";

type Props = {
  searchParams: Promise<{
    poiId?: string;
  }>;
};

export default async function RomePage({ searchParams }: Props) {
  const query = await searchParams;
  const initialSelectedPoiId = query.poiId;

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-zinc-200/80 bg-white px-5 py-3 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
            <MapPinIcon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
                Cultural Atlas – Rome
              </h1>
              <WorkInProgressBadge />
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">A simple starting point: a map centered on Rome.</p>
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1">
        <RomeMap initialSelectedPoiId={initialSelectedPoiId} />
      </section>
    </main>
  );
}
