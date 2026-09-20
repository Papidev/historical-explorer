import type { PublicPerson } from "@/server/person";

const formatDate = (date: NonNullable<PublicPerson["birthDate"]>) => {
  const year = `${Math.abs(date.year)} ${date.year < 0 ? "BC" : "AD"}`;
  const value = date.month
    ? `${date.day ? `${date.day}/` : ""}${date.month}/${year}`
    : year;
  return `${date.precision === "approximate" ? "c. " : ""}${value}`;
};

export const Person = ({ person }: { person: PublicPerson }) => (
  <article className="space-y-6 text-base leading-[1.7] text-zinc-800">
    {person.image ? (
      <figure className="overflow-hidden rounded-xl bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- Person images use runtime-selected Wikimedia URLs. */}
        <img
          src={person.image.thumbnailUrl}
          alt={person.name}
          className="max-h-72 w-full object-contain"
        />
        {person.image.attribution ? (
          <figcaption className="px-3 py-2 text-xs text-zinc-500">
            {person.image.attribution}
            {person.image.license ? ` · ${person.image.license}` : ""}
          </figcaption>
        ) : null}
      </figure>
    ) : null}
    {person.birthDate || person.deathDate ? (
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-amber-50 p-3 text-sm">
        {person.birthDate ? <div><dt className="font-semibold">Born</dt><dd>{formatDate(person.birthDate)}</dd></div> : null}
        {person.deathDate ? <div><dt className="font-semibold">Died</dt><dd>{formatDate(person.deathDate)}</dd></div> : null}
      </dl>
    ) : null}
    <div className="space-y-4">
      {person.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </div>
    {person.curiosities.length > 0 ? (
      <section className="rounded-xl bg-sky-50/55 px-4 py-3 ring-1 ring-sky-950/5">
        <h3 className="text-sm font-semibold tracking-wide text-zinc-950 uppercase">Curiosities</h3>
        <ul className="mt-3 list-disc space-y-3 pl-5 marker:text-sky-400">
          {person.curiosities.map((curiosity) => <li key={curiosity}>{curiosity}</li>)}
        </ul>
      </section>
    ) : null}
  </article>
);
