// THROWAWAY, round 2: daylight, city fragments, and a curious bird on /?variant=A|B|C.
import { Daylight } from "./Daylight";
import { Fragments } from "./Fragments";
import { Wanderer } from "./Wanderer";

export const LogoPrototype = ({
  variant,
  large = false,
  markOnly = false,
  tone = "light",
}: {
  variant: "A" | "B" | "C";
  large?: boolean;
  markOnly?: boolean;
  tone?: "light" | "dark";
}) => (
  <span
    aria-hidden="true"
    className={`inline-flex ${markOnly ? "text-[1em]" : large ? "text-6xl sm:text-8xl" : "text-4xl"}`}
  >
    {variant === "A" ? (
      <Daylight markOnly={markOnly} />
    ) : variant === "B" ? (
      <Fragments markOnly={markOnly} />
    ) : (
      <Wanderer markOnly={markOnly} tone={tone} />
    )}
  </span>
);
