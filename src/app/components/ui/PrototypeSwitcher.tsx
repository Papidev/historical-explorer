"use client";

// THROWAWAY: URL-backed logo comparison controls; remove after selecting a direction.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { IconButton } from "./IconButton";

export const PrototypeSwitcher = ({ current }: { current: "A" | "B" | "C" }) => {
  const router = useRouter();
  const variants = ["A", "B", "C"] as const;
  const previous = variants[(variants.indexOf(current) + 2) % 3];
  const next = variants[(variants.indexOf(current) + 1) % 3];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
          ))
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        router.replace(`/?variant=${event.key === "ArrowLeft" ? previous : next}`, {
          scroll: false,
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, previous, next]);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <nav
      aria-label="Logo prototype variants"
      className="fixed bottom-5 left-1/2 z-50 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-4 rounded-full border border-white/20 bg-zinc-900 px-3 py-3 text-white shadow-xl"
    >
      <IconButton
        label="Previous logo variant"
        onClick={() => router.replace(`/?variant=${previous}`, { scroll: false })}
      >
        <ArrowLeftIcon />
      </IconButton>
      <div aria-live="polite" className="text-center text-sm">
        <span className="block text-[10px] tracking-widest text-yellow-300 uppercase">
          Logo study · Round 02
        </span>
        <span>
          {current} ·{" "}
          {current === "A" ? "Daylight" : current === "B" ? "City fragments" : "The wanderer"}
        </span>
      </div>
      <IconButton
        label="Next logo variant"
        onClick={() => router.replace(`/?variant=${next}`, { scroll: false })}
      >
        <ArrowRightIcon />
      </IconButton>
    </nav>
  );
};
