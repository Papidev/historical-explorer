import localFont from "next/font/local";

const fraunces = localFont({ src: "./fonts/Fraunces.ttf", display: "swap", preload: false });

export const Wanderer = ({ markOnly = false }: { markOnly?: boolean }) => (
  <span
    className={`${fraunces.className} inline-flex items-center gap-[0.13em] font-medium tracking-[-0.055em]`}
  >
    <svg
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      className={markOnly ? "size-[1em] shrink-0" : "size-[1.15em] shrink-0"}
    >
      <path
        d="M13 49c8 1 11-5 17-16 4-8 9-12 16-12 8 0 13 7 11 15l12 5-13 4c-4 10-14 17-24 16-9-1-14-5-19-12Z"
        fill="currentColor"
      />
      <path d="M24 45c8-5 17-6 24-3-3 10-11 15-19 11" className="fill-yellow-300" />
      <circle cx="49" cy="31" r="2.2" className="fill-yellow-50" />
      <path
        d="m35 61-3 10m15-13 3 12m-23 2h10m9-1h9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="m59 18 3-6m4 13 7-2"
        className="stroke-yellow-500"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
    {!markOnly && <span className="leading-none">mira</span>}
  </span>
);
