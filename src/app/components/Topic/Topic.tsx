export const Topic = ({ title, insights }: { title: string; insights: string[] }) =>
  insights.length > 0 ? (
    <section className="rounded-xl bg-zinc-50/80 px-4 py-3 ring-1 ring-zinc-950/5">
      <h3 className="text-sm font-semibold tracking-wide text-zinc-950 uppercase">{title}</h3>
      <ul className="mt-3 list-disc space-y-3 pl-5 marker:text-zinc-400">
        {insights.map((description, index) => (
          <li key={`${title}-${index}`} className="pl-1">
            {description}
          </li>
        ))}
      </ul>
    </section>
  ) : null;
