"use client";

import { useEffect } from "react";

// Throwaway prototype control. Arrow keys change variants outside an open gallery.
export const PrototypeSwitcher = ({
  variant,
  keyboardEnabled,
  onChange,
}: {
  variant: string;
  keyboardEnabled: boolean;
  onChange: (variant: string) => void;
}) => {
  const cycle = (direction: number) =>
    onChange(["A", "B", "C"][(["A", "B", "C"].indexOf(variant) + direction + 3) % 3]);
  useEffect(() => {
    if (!keyboardEnabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        cycle(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (process.env.NODE_ENV === "production") return null;
  return (
    <nav
      aria-label="Gallery prototype variants"
      className="fixed bottom-4 left-1/2 z-[100] flex w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-indigo-950 px-3 py-2 text-xs text-white shadow-xl"
    >
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => cycle(-1)}
        className="cursor-pointer rounded-full px-3 py-2 hover:bg-white/15"
      >
        ←
      </button>
      <span aria-live="polite">
        Prototype · {variant} · {{ A: "Cinema", B: "Light table", C: "Photo strip" }[variant]}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => cycle(1)}
        className="cursor-pointer rounded-full px-3 py-2 hover:bg-white/15"
      >
        →
      </button>
    </nav>
  );
};
