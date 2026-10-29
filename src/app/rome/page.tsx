import { AppVersion } from "@/app/components/ui/AppVersion";
import { RefreshPoiCategories } from "@/app/components/RefreshPoiCategories";
import { MiraLogo } from "@/app/components/ui/MiraLogo";
import { RomeMap } from "@/app/components/RomeMap";
import { WorkInProgressNotice } from "@/app/components/ui/WorkInProgressNotice";
import Link from "next/link";

type Props = {
  searchParams: Promise<{
    poiId?: string;
  }>;
};

const RomePage = async ({ searchParams }: Props) => {
  const query = await searchParams;
  const initialSelectedPoiId = query.poiId;

  return (
    <main className="flex h-dvh flex-col bg-zinc-50 text-zinc-900">
      <WorkInProgressNotice />
      <RefreshPoiCategories city="rome" />
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-900/15 px-4 py-3 md:gap-6 md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-4 md:gap-6">
          <Link
            href="/"
            aria-label="Mira home"
            className="flex shrink-0 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
          >
            <MiraLogo size="small" />
          </Link>
          <div className="min-w-0 border-l border-zinc-900/15 pl-4 md:pl-6">
            <h1 className="font-serif text-3xl tracking-tight md:text-4xl">Rome</h1>
            <p className="mt-1 hidden text-sm text-zinc-500 lg:block">
              Discover the art, history, and people behind the places.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <span className="hidden sm:inline-flex">
            <AppVersion />
          </span>
          {process.env.NODE_ENV === "development" && (
            <Link
              href="/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-white hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800"
            >
              Admin
            </Link>
          )}
        </div>
      </header>

      <section className="min-h-0 flex-1">
        <RomeMap initialSelectedPoiId={initialSelectedPoiId} />
      </section>
    </main>
  );
};

export default RomePage;
