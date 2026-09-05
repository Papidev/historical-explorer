import {
  ArrowRightIcon,
  BookOpenIcon,
  LinkIcon,
  MapIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

const highlights = [
  {
    title: "Interactive city maps",
    description:
      "Navigate accurate base layers, custom overlays, and annotations that call out important locations from antiquity.",
  },
  {
    title: "Visitor-first stories",
    description:
      "Short, source-grounded stories help you notice what matters at each point of interest.",
  },
  {
    title: "Cultural connections",
    description:
      "Connect places with the people, art, and history that shaped them.",
  },
];

const highlightIcons = [MapIcon, BookOpenIcon, LinkIcon];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-14 px-6 py-12 sm:py-20">
        <section className="relative overflow-hidden rounded-3xl bg-zinc-950 px-7 py-10 text-white shadow-xl shadow-zinc-900/10 sm:px-12 sm:py-14">
          <div className="absolute -top-24 -right-20 size-72 rounded-full bg-rose-500/20 blur-3xl" />
          <p className="relative text-sm font-semibold tracking-[0.2em] text-rose-300 uppercase">
            Cultural Atlas
          </p>
          <h1 className="relative mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Step inside the cities that shaped world history.
          </h1>
          <p className="relative mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
            Cultural Atlas pairs interactive city maps with concise, source-grounded stories that help you
            notice, understand, and remember the places around you.
          </p>
        </section>

        <section>
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-rose-600 uppercase">Explore a city</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Begin with Rome</h2>
          </div>
          <Link
            href="/rome"
            className="group block rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-950/5 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                  <MapPinIcon className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-zinc-950">Rome</h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
                    Explore monuments, stories, and details from the city’s ancient and enduring landscape.
                  </p>
                </div>
              </div>
              <ArrowRightIcon
                className="mt-1 size-5 shrink-0 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-rose-600"
                aria-hidden="true"
              />
            </div>
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {highlights.map((highlight, index) => {
            const Icon = highlightIcons[index];

            return (
              <article
                key={highlight.title}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-zinc-950">{highlight.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{highlight.description}</p>
            </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
