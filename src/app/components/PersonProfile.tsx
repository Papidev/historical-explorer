import type { PublicPersonProfile } from "@/server/personProfile";

const formatDate = (date: NonNullable<PublicPersonProfile["birthDate"]>) => {
  const year = `${Math.abs(date.year)} ${date.year < 0 ? "BC" : "AD"}`;
  const value = date.month
    ? `${date.day ? `${date.day}/` : ""}${date.month}/${year}`
    : year;
  return `${date.precision === "approximate" ? "c. " : ""}${value}`;
};

export const PersonProfile = ({ profile }: { profile: PublicPersonProfile }) => (
  <article className="space-y-6 text-base leading-[1.7] text-zinc-800">
    {profile.image ? (
      <figure className="overflow-hidden rounded-xl bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- Person images use runtime-selected Wikimedia URLs. */}
        <img
          src={profile.image.thumbnailUrl}
          alt={profile.name}
          className="max-h-72 w-full object-contain"
        />
        {profile.image.attribution ? (
          <figcaption className="px-3 py-2 text-xs text-zinc-500">
            {profile.image.attribution}
            {profile.image.license ? ` · ${profile.image.license}` : ""}
          </figcaption>
        ) : null}
      </figure>
    ) : null}
    {profile.birthDate || profile.deathDate ? (
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-amber-50 p-3 text-sm">
        {profile.birthDate ? <div><dt className="font-semibold">Born</dt><dd>{formatDate(profile.birthDate)}</dd></div> : null}
        {profile.deathDate ? <div><dt className="font-semibold">Died</dt><dd>{formatDate(profile.deathDate)}</dd></div> : null}
      </dl>
    ) : null}
    <div className="space-y-4">
      {profile.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </div>
    {profile.curiosities.length > 0 ? (
      <section className="rounded-xl bg-sky-50/55 px-4 py-3 ring-1 ring-sky-950/5">
        <h3 className="text-sm font-semibold tracking-wide text-zinc-950 uppercase">Curiosities</h3>
        <ul className="mt-3 list-disc space-y-3 pl-5 marker:text-sky-400">
          {profile.curiosities.map((curiosity) => <li key={curiosity}>{curiosity}</li>)}
        </ul>
      </section>
    ) : null}
  </article>
);
