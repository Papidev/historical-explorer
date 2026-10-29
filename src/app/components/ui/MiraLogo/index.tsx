import clsx from "clsx";
import localFont from "next/font/local";
import { Bird } from "./Bird";

const fraunces = localFont({ src: "./Fraunces.ttf", display: "swap", weight: "500" });

export const MiraLogo = ({
  size = "medium",
  tone = "light",
}: {
  size?: "small" | "medium" | "large";
  tone?: "light" | "dark";
}) => (
  <span
    role="img"
    aria-label="Mira"
    className={clsx(
      fraunces.className,
      "inline-flex items-center gap-[0.13em] font-medium tracking-[-0.055em]",
      { small: "text-2xl", medium: "text-3xl", large: "text-4xl" }[size],
      tone === "dark" ? "text-zinc-50" : "text-zinc-900",
    )}
  >
    <Bird tone={tone} />
    <span aria-hidden="true" className="leading-none">
      mira
    </span>
  </span>
);
