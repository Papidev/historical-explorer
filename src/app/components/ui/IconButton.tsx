"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const sizes = {
  small: "p-1",
  medium: "p-1.5",
  large: "p-2",
} as const;

const tones = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500",
  secondary:
    "border border-black/15 bg-white text-black hover:bg-black/3 focus-visible:outline-black dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:focus-visible:outline-white",
  danger:
    "bg-red-700 text-white hover:bg-red-600 focus-visible:outline-red-700 dark:bg-red-600 dark:hover:bg-red-500 dark:focus-visible:outline-red-600",
} as const;

export const IconButton = ({
  children,
  className,
  label,
  size = "medium",
  tone = "secondary",
  type = "button",
  ...props
}: {
  children: ReactNode;
  label: string;
  size?: keyof typeof sizes;
  tone?: keyof typeof tones;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "size">) => (
  <button
    {...props}
    type={type}
    aria-label={label}
    title={props.title ?? label}
    className={clsx(
      "inline-flex items-center justify-center rounded-full shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none [&_svg]:size-5 [&_svg]:shrink-0",
      sizes[size],
      tones[tone],
      className,
    )}
  >
    <span aria-hidden="true">{children}</span>
  </button>
);
