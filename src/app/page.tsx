import Link from "next/link";

const highlights = [
  {
    title: "Interactive city maps",
    description:
      "Navigate accurate base layers, custom overlays, and annotations that call out important locations from antiquity.",
  },
  {
    title: "Story-driven timelines",
    description:
      "Each map pairs with short historical briefs so you always know why a monument or route mattered to the era.",
  },
  {
    title: "Curated field notes",
    description:
      "Links to articles, museum collections, and academic sources help you dig deeper once a spot sparks your curiosity.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-16 px-6 py-24">
        <section className="rounded-3xl bg-white p-10 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-500">Historical Explorer</p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
            Step inside the cities that shaped world history.
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-zinc-600">
            This project gathers handcrafted maps, narratives, and primary sources for major historical centers.
            Start with an interactive tour of imperial Rome, then follow along as we add new cities, trade routes,
            and thematic journeys across eras.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/rome"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Explore the Rome map
            </Link>
            <a
              href="mailto:team@historical-explorer.io"
              className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:border-zinc-300"
            >
              Request another city
            </a>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((highlight) => (
            <article key={highlight.title} className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">{highlight.title}</h2>
              <p className="mt-3 text-sm text-zinc-600">{highlight.description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
