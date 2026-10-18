"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

type Props = {
  variant?: string;
};

const variants = ["a", "b", "c"] as const;
const names = ["Story on photo", "Editorial note", "Map to Story"];

export const PrototypeSwitcher = ({ variant }: Props) => {
  const router = useRouter();
  const current = Math.max(0, variants.indexOf(variant as (typeof variants)[number]));
  const goTo = (direction: number) =>
    router.replace(
      `/?variant=${variants[(current + direction + variants.length) % variants.length]}`,
    );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, [contenteditable]")
      )
        return;
      event.preventDefault();
      goTo(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div
      className="fixed right-4 bottom-4 left-4 z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-zinc-900 p-2 text-white shadow-2xl"
      aria-label="Homepage prototype variants"
    >
      <button
        type="button"
        onClick={() => goTo(-1)}
        aria-label="Previous variant"
        className="cursor-pointer rounded-full p-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-32 text-center text-xs font-medium">
        {variants[current].toUpperCase()} · {names[current]}
      </span>
      <button
        type="button"
        onClick={() => goTo(1)}
        aria-label="Next variant"
        className="cursor-pointer rounded-full p-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
      >
        <ArrowRightIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
};
