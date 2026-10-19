import { ArrowRightIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";

export const MapShowcase = () => (
  <section
    aria-labelledby="map-showcase-title"
    className="border-t border-zinc-900/15 py-12 sm:py-16"
  >
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-800 uppercase">
          Find a place. Follow its story.
        </p>
        <h2 id="map-showcase-title" className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">
          Explore Rome on the map
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">
          Open a place&apos;s Story for a quick sense of what makes it interesting. Each Story links
          to Wikipedia if you want to explore further.
        </p>
      </div>
      <Link
        href="/rome"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
      >
        Open the map <ArrowRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </div>
    <figure>
      <Link
        href="/rome"
        aria-label="Explore Rome on the map"
        className="block cursor-pointer overflow-x-auto rounded-2xl border border-zinc-900/10 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
      >
        <Image
          src="/rome-map-showcase-ara-pacis.jpg"
          alt="Cultural Atlas map of Rome with place markers, an Ara Pacis preview, and the Castel Sant’Angelo detail panel open"
          width={1700}
          height={900}
          className="h-auto w-full min-w-180"
        />
      </Link>
      <figcaption className="mt-3 text-right text-xs leading-5 text-zinc-500">
        Map: OpenFreeMap · © OpenMapTiles ·{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
        >
          OpenStreetMap contributors ↗
        </a>
      </figcaption>
    </figure>
  </section>
);
