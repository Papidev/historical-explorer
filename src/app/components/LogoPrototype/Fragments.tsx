import localFont from "next/font/local";

const bricolage = localFont({
  src: "./fonts/BricolageGrotesque.ttf",
  display: "swap",
  preload: false,
});

export const Fragments = ({ markOnly = false }: { markOnly?: boolean }) => (
  <span
    className={`${bricolage.className} inline-flex items-center gap-[0.19em] font-bold tracking-[-0.065em]`}
  >
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={markOnly ? "size-[1em] shrink-0" : "size-[0.9em] shrink-0"}
    >
      <path d="M5 5h23v23H5Z" fill="currentColor" />
      <path d="M37 5h23v23H37Z" className="fill-yellow-400" />
      <path d="M5 37h23v23H5Z" stroke="currentColor" strokeWidth="3" />
      <path d="M38 60V38h22M39 59l20-20" stroke="currentColor" strokeWidth="3" />
    </svg>
    {!markOnly && <span className="leading-none">mira</span>}
  </span>
);
