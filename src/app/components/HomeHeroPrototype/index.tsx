import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, MapPinIcon } from "@heroicons/react/24/outline";
import catalog from "../../../../data/public/catalog.json";

type Props = {
  cover: (typeof catalog.pois)[number];
  variant: "a" | "b" | "c";
};

// Prototype: three ways to show a real Story beside the existing evocative photo.
export const HomeHeroPrototype = ({ cover, variant }: Props) => {
  const storyUrl = `/rome?poiId=${encodeURIComponent(cover.poi.id)}`;

  return (
    <figure className={variant === "b" ? "relative lg:col-span-1" : "relative"}>
      <div
        className={
          variant === "b"
            ? "grid overflow-hidden rounded-2xl border border-zinc-900/10 bg-white shadow-sm sm:grid-cols-[3fr_2fr]"
            : variant === "c"
              ? "overflow-hidden rounded-2xl border border-zinc-900/10 bg-white shadow-sm"
              : "relative pb-20 sm:pb-14"
        }
      >
        <div
          className={
            variant === "b"
              ? "relative min-h-96 overflow-hidden bg-zinc-200 sm:min-h-152"
              : variant === "c"
                ? "relative aspect-5/4 overflow-hidden bg-zinc-200"
                : "relative aspect-4/5 overflow-hidden rounded-t-[10rem] rounded-b-2xl bg-zinc-200 sm:aspect-5/4 lg:aspect-4/5"
          }
        >
          <Image
            src={cover.mainImage.thumbnailUrl}
            alt={cover.poi.name}
            fill
            preload
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-linear-to-t from-zinc-950/70 via-transparent to-transparent"
            aria-hidden="true"
          />
          <div className="absolute right-6 bottom-7 left-6 text-white">
            {variant !== "a" && (
              <p className="text-xs font-medium tracking-[0.2em] uppercase">
                The first city in our atlas
              </p>
            )}
            <p className="mt-2 font-serif text-4xl sm:text-5xl">
              Rome
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-zinc-100">
              <MapPinIcon className="size-4" aria-hidden="true" />
              {cover.poi.name}
            </p>
          </div>
        </div>

        {variant === "a" && (
          <Link
            href={storyUrl}
            className="group absolute right-0 bottom-0 left-6 rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-xl transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800 sm:left-auto sm:w-80"
          >
            <span className="text-xs font-semibold tracking-[0.16em] text-zinc-600 uppercase">
              A story behind the place
            </span>
            <span className="mt-2 block font-serif text-2xl text-zinc-900">
              From mausoleum to fortress
            </span>
            <span className="mt-2 block text-sm leading-6 text-zinc-600">
              Built for Hadrian, the castle later became a papal refuge connected to the Vatican by
              a fortified passage.
            </span>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
              Read the Story{" "}
              <ArrowRightIcon
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </span>
          </Link>
        )}

        {variant === "b" && (
          <div className="flex flex-col justify-center p-6 sm:p-7">
            <span className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
              Look a little closer
            </span>
            <p className="mt-5 font-serif text-2xl leading-tight text-zinc-900 sm:text-3xl">
              A passage between two worlds
            </p>
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              The Passetto di Borgo connected this former imperial tomb to St. Peter’s Basilica,
              making it a refuge for popes.
            </p>
            <Link
              href={storyUrl}
              className="mt-7 inline-flex items-center gap-2 self-start text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
            >
              Read the Story <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {variant === "c" && (
          <div className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <span className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-800">
                1
              </span>
              Find on the map
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                2 · Discover the Story
              </p>
              <p className="mt-1 font-serif text-xl text-zinc-900">
                An emperor’s tomb became a papal fortress.
              </p>
            </div>
            <Link
              href={storyUrl}
              className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
            >
              Explore <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
      <figcaption className="mt-3 text-right text-xs leading-5 text-zinc-500">
        Photo: {cover.mainImage.attribution} ·{" "}
        <a
          href={cover.mainImage.commonsPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
        >
          {cover.mainImage.license} ↗
        </a>
      </figcaption>
    </figure>
  );
};
