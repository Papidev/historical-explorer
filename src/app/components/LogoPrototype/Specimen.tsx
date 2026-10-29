import { LogoPrototype } from ".";

export const Specimen = ({ variant }: { variant: "A" | "B" | "C" }) => (
  <section
    aria-label="Logo design prototype"
    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
  >
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-5 py-3 text-xs text-zinc-500">
      <span className="font-semibold tracking-widest uppercase">
        Mira / Identity studies / Round 02
      </span>
      <span>Throwaway prototype · {variant} of A–C</span>
    </div>
    <div className="grid lg:grid-cols-[1.25fr_1fr]">
      <div className="flex min-h-64 items-center justify-center bg-amber-50/60 px-5 py-12 text-zinc-900 sm:min-h-80">
        <span
          role="img"
          aria-label={`Mira logo, ${variant === "A" ? "Daylight" : variant === "B" ? "City fragments" : "The wanderer"}`}
        >
          <LogoPrototype variant={variant} large />
        </span>
      </div>
      <div className="flex flex-col justify-center px-6 py-8 sm:px-8">
        <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          Direction {variant}
        </p>
        <h2 className="mt-2 font-serif text-3xl text-zinc-900">
          {variant === "A" ? "Daylight" : variant === "B" ? "City fragments" : "The wanderer"}
        </h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-zinc-600">
          {variant === "A"
            ? "A warm editorial wordmark, with a small, irregular sun like a note in the margin. A place becomes interesting when a detail comes to light."
            : variant === "B"
              ? "A city is a collection of fragments. Solid, open and unfinished tiles come together beside a confident, slightly unconventional wordmark."
              : "A little city bird pauses, looks up and notices something. An illustrated companion gives Mira a curious, approachable personality."}
        </p>
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          {variant === "A"
            ? "Fraunces · Serif wordmark · Yellow as light"
            : variant === "B"
              ? "Bricolage Grotesque · Modular symbol · Yellow as one fragment"
              : "Fraunces · Original bird illustration · Yellow as a small discovery"}
        </p>
        <a
          href={
            variant === "A"
              ? "https://siarchives.si.edu/blog/design-archives-one-smithsonian"
              : variant === "B"
                ? "https://www.eduardoaires.com/projects/project/porto.html"
                : "https://thecreativeindependent.com/about/"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 w-fit rounded-sm text-xs text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Reference:{" "}
          {variant === "A"
            ? "Smithsonian — light & knowledge"
            : variant === "B"
              ? "Porto — stories in fragments"
              : "The Creative Independent — slow curiosity"}{" "}
          ↗
        </a>
      </div>
    </div>
    <div className="grid border-t border-zinc-200 sm:grid-cols-2">
      <div className="flex min-h-32 items-center justify-between gap-4 px-6 py-6 text-zinc-900 sm:px-8">
        <div>
          <p className="text-xs font-medium text-zinc-500">Small symbol</p>
          <p className="mt-1 text-xs text-zinc-400">16 / 24 / 40 px</p>
        </div>
        <div aria-hidden="true" className="flex items-center gap-5">
          <span className="text-base">
            <LogoPrototype variant={variant} markOnly />
          </span>
          <span className="text-2xl">
            <LogoPrototype variant={variant} markOnly />
          </span>
          <span className="text-[40px]">
            <LogoPrototype variant={variant} markOnly />
          </span>
        </div>
      </div>
      <div className="flex min-h-32 items-center justify-between gap-4 bg-zinc-900 px-6 py-6 text-zinc-50 sm:px-8">
        <span className="text-xs text-zinc-400">On dark</span>
        <LogoPrototype variant={variant} tone="dark" />
      </div>
    </div>
    <p className="border-t border-zinc-200 px-5 py-3 text-xs leading-5 text-zinc-500">
      Compare the navigation logo above, the enlarged drawing, and its small symbol. Switch with ← →
      or the controls below.
    </p>
  </section>
);
