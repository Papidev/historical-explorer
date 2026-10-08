import { RefreshPoiCategories } from "@/app/components/RefreshPoiCategories";
import { MapPinIcon } from "@heroicons/react/24/outline";
import { RomeMap } from "@/app/components/RomeMap";
import { WorkInProgressBadge } from "@/app/components/ui/WorkInProgressBadge";
import Link from "next/link";

type Props = {
  searchParams: Promise<{
    poiId?: string;
  }>;
};

export default async function RomePage({ searchParams }: Props) {
  const query = await searchParams;
  const initialSelectedPoiId = query.poiId;

  return (
    <main className="flex h-dvh flex-col">
      <RefreshPoiCategories city="rome" />
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200/80 bg-white px-3 py-2 shadow-sm md:gap-6 md:px-6 md:py-3">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 md:size-10">
            <MapPinIcon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-950 md:text-2xl">
                Cultural Atlas – Rome
              </h1>
              <span className="hidden md:inline-flex">
                <WorkInProgressBadge />
              </span>
            </div>
            <p className="mt-0.5 hidden text-sm text-zinc-500 md:block">
              A simple starting point: a map centered on Rome.
            </p>
          </div>
        </div>
        {process.env.NODE_ENV === "development" && (
          <Link
            href="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
          >
            Admin
          </Link>
        )}
      </header>

      <section className="min-h-0 flex-1">
        <RomeMap initialSelectedPoiId={initialSelectedPoiId} />
      </section>
    </main>
  );
}
