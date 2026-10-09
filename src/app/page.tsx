import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  GlobeAltIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import catalog from "../../data/public/catalog.json";
import { WorkInProgressBadge } from "@/app/components/ui/WorkInProgressBadge";

const Home = () => {
  const cover =
    catalog.pois.find(({ poi }) => poi.id === "castle-of-the-holy-angel") ?? catalog.pois[0];
  const discoveries = ["piazza-navona", "cloisters-of-bramante", "forum-boarium"]
    .map((id) => catalog.pois.find(({ poi }) => poi.id === id))
    .filter((entry) => entry !== undefined);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-white p-3 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-20"
      >
        Skip to content
      </a>
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-6 sm:px-8 lg:px-12">
        <Link
          href="/"
          aria-label="Cultural Atlas home"
          className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
        >
          <GlobeAltIcon className="size-7 text-zinc-800" aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight">Cultural Atlas</span>
        </Link>
        <WorkInProgressBadge />
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <section
          aria-labelledby="hero-title"
          className="grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-2 lg:gap-16 lg:py-20"
        >
          <div>
            <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.2em] text-zinc-800 uppercase">
              <span className="h-px w-8 bg-zinc-800" aria-hidden="true" />A closer look at places
            </p>
            <h1
              id="hero-title"
              className="mt-6 max-w-xl font-serif text-5xl leading-[1.08] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl"
            >
              Every place has a <span className="text-zinc-800 italic">story.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
              Discover the art, history, and people behind the places on the map. A few meaningful
              details can change the way you see a city.
            </p>
            <p className="mt-6 max-w-md text-base leading-7 text-zinc-600">
              <span className="font-semibold text-zinc-900">Our atlas begins in Rome.</span> More
              cities will follow.
            </p>
            <Link
              href="/rome"
              className="group mt-6 inline-flex items-center gap-6 rounded-full bg-zinc-800 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
            >
              Explore Rome
              <ArrowRightIcon
                className="size-5 motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <p className="mt-4 text-sm text-zinc-500">From your doorstep, or from anywhere.</p>
          </div>

          {cover && (
            <figure className="relative">
              <div className="relative aspect-4/5 overflow-hidden rounded-t-[10rem] rounded-b-2xl bg-zinc-200 sm:aspect-5/4 lg:aspect-4/5">
                <Image
                  src={cover.mainImage.thumbnailUrl}
                  alt={cover.poi.name}
                  fill
                  unoptimized
                  preload
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <div
                  className="absolute inset-0 bg-linear-to-t from-zinc-950/80 via-transparent to-transparent"
                  aria-hidden="true"
                />
                <div className="absolute right-6 bottom-7 left-6 text-white sm:right-8 sm:left-8">
                  <p className="text-xs font-medium tracking-[0.2em] text-zinc-100 uppercase">
                    The first city in our atlas
                  </p>
                  <p className="mt-2 font-serif text-5xl sm:text-6xl">Rome</p>
                  <p className="mt-3 flex items-center gap-2 text-sm text-zinc-200">
                    <MapPinIcon className="size-4" aria-hidden="true" />
                    {cover.poi.name}
                  </p>
                </div>
              </div>
              <figcaption className="mt-3 text-right text-xs leading-5 text-zinc-500">
                Photo: {cover.mainImage.attribution} ·{" "}
                <a
                  href={cover.mainImage.commonsPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800"
                >
                  {cover.mainImage.license} ↗
                </a>
              </figcaption>
            </figure>
          )}
        </section>

        <section
          aria-label="How to explore"
          className="grid gap-7 border-y border-zinc-900/15 py-8 sm:grid-cols-3 sm:gap-8"
        >
          {[
            {
              number: "01",
              title: "Find a place",
              description: "Follow your curiosity across the city map.",
            },
            {
              number: "02",
              title: "Look a little closer",
              description: "Read a short story. Notice a detail you might have missed.",
            },
            {
              number: "03",
              title: "Make a connection",
              description: "Meet the people and ideas that helped shape the place.",
            },
          ].map(({ number, title, description }) => (
            <div key={number} className="flex gap-4">
              <span className="pt-0.5 font-serif text-xl text-zinc-800" aria-hidden="true">
                {number}
              </span>
              <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-600">{description}</p>
              </div>
            </div>
          ))}
        </section>

        {discoveries.length > 0 && (
          <section aria-labelledby="discoveries-title" className="py-12 sm:py-16">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-zinc-800 uppercase">
                  Start with a little curiosity
                </p>
                <h2
                  id="discoveries-title"
                  className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl"
                >
                  One city. Many stories.
                </h2>
              </div>
              <Link
                href="/rome"
                className="group inline-flex items-center gap-2 rounded-sm py-1 text-sm font-semibold text-zinc-800 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
              >
                See the map{" "}
                <ArrowRightIcon
                  className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              {discoveries.map(({ poi, mainImage }) => (
                <article key={poi.id}>
                  <Link
                    href={`/rome?poiId=${encodeURIComponent(poi.id)}`}
                    className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-800"
                  >
                    <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-zinc-200">
                      <Image
                        src={mainImage.thumbnailUrl}
                        alt={poi.name}
                        fill
                        unoptimized
                        sizes="(min-width: 640px) 33vw, 100vw"
                        className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
                      />
                      <span className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-zinc-50 text-zinc-900">
                        <ArrowUpRightIcon className="size-5" aria-hidden="true" />
                      </span>
                    </div>
                    <h3 className="mt-4 font-serif text-2xl group-hover:text-zinc-800">
                      {poi.name}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-600">
                      {poi.previewDescription}
                    </p>
                  </Link>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Photo: {mainImage.attribution} ·{" "}
                    <a
                      href={mainImage.commonsPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800"
                    >
                      {mainImage.license} ↗
                    </a>
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-zinc-900/15 px-5 py-6 text-xs text-zinc-500 sm:px-8 lg:px-12">
        <p>Cultural Atlas · Art, history, and the places between.</p>
        <p>An atlas in the making. Begin with Rome.</p>
      </footer>
    </div>
  );
};

export default Home;
