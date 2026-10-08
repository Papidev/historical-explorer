"use client";

import clsx from "clsx";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { ButtonHTMLAttributes } from "react";

export const DrawerTab = ({
  label,
  side = "left",
  className,
  type = "button",
  ...props
}: {
  label: string;
  side?: "left" | "right";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) => (
  <button
    {...props}
    type={type}
    className={clsx(
      "group absolute inset-y-0 z-10 w-10 cursor-pointer touch-pan-y focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      side === "left" ? "left-0" : "right-0",
      className,
    )}
  >
    <span
      className={clsx(
        "absolute top-1/2 flex w-10 -translate-y-1/2 flex-col items-center gap-3 border border-rose-700 bg-rose-700 py-4 text-white shadow-md group-hover:bg-rose-800 group-focus-visible:ring-2 group-focus-visible:ring-rose-600",
        side === "left" ? "left-0 rounded-r-xl border-l-0" : "right-0 rounded-l-xl border-r-0",
      )}
    >
      {side === "left" ? (
        <ChevronRightIcon aria-hidden="true" className="size-5" />
      ) : (
        <ChevronLeftIcon aria-hidden="true" className="size-5" />
      )}
      <span className="text-sm font-bold tracking-wide [writing-mode:vertical-rl]">{label}</span>
    </span>
  </button>
);
