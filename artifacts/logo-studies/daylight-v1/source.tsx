import localFont from "next/font/local";

const fraunces = localFont({ src: "./fonts/Fraunces.ttf", display: "swap", preload: false });

export const Daylight = ({ markOnly = false }: { markOnly?: boolean }) => (
  <span
    className={`${fraunces.className} inline-flex items-start font-semibold tracking-[-0.065em]`}
  >
    {!markOnly && <span className="leading-none">Mira</span>}
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={markOnly ? "size-[1em]" : "mt-[0.03em] ml-[0.08em] size-[0.43em] shrink-0"}
    >
      <path
        d="m30 3 7 17 17-9-9 18 17 5-19 6 7 19-17-12-12 15 1-20L2 38l18-10L9 12l18 9Z"
        className="fill-yellow-400"
      />
      <circle cx="32" cy="32" r="5" fill="currentColor" />
    </svg>
  </span>
);
