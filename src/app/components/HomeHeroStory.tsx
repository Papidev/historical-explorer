import { ArrowRightIcon, MapPinIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import catalog from "../../../data/public/catalog.json";

type Props = {
  cover: (typeof catalog.pois)[number];
};

export const HomeHeroStory = ({ cover }: Props) => (
  <figure className="relative">
    <div className="relative pb-20 sm:pb-14">
      <div className="relative aspect-4/5 overflow-hidden rounded-t-[10rem] rounded-b-2xl bg-zinc-200 sm:aspect-5/4 lg:aspect-4/5">
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
          <p className="mt-2 font-serif text-4xl sm:text-5xl">Rome</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-100">
            <MapPinIcon className="size-4" aria-hidden="true" />
            {cover.poi.name}
          </p>
        </div>
      </div>

      <Link
        href={`/rome?poiId=${encodeURIComponent(cover.poi.id)}`}
        className="group absolute right-0 bottom-0 left-6 rounded-2xl border border-zinc-900/10 bg-white p-5 shadow-xl transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800 sm:left-auto sm:w-80"
      >
        <span className="text-xs font-semibold tracking-[0.16em] text-zinc-600 uppercase">
          A story behind the place
        </span>
        <span className="mt-2 block font-serif text-2xl text-zinc-900">
          From mausoleum to fortress
        </span>
        <span className="mt-2 block text-sm leading-6 text-zinc-600">
          Built for Hadrian, the castle later became a papal refuge connected to the Vatican by a
          fortified passage.
        </span>
        <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
          Read the Story{" "}
          <ArrowRightIcon
            className="size-4 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </Link>
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
