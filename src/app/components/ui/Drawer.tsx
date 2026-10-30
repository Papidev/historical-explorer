"use client";

import { Transition, TransitionChild } from "@headlessui/react";
import clsx from "clsx";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export const Drawer = ({
  open,
  side,
  width,
  afterLeave,
  children,
  className,
  ...props
}: {
  open: boolean;
  side: "left" | "right";
  width?: number;
  afterLeave?: () => void;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">) => (
  <Transition
    as="div"
    show={open}
    appear
    unmount={false}
    afterLeave={afterLeave}
    style={width ? ({ "--panel-width": `${width}px` } as CSSProperties) : undefined}
    className="contents"
  >
    <TransitionChild
      as="aside"
      unmount={false}
      {...props}
      aria-hidden={!open}
      inert={!open}
      className={clsx(
        "inset-y-0 z-20 border-black/10 bg-white transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        side === "left"
          ? "left-0 border-r data-closed:-translate-x-full"
          : "right-0 border-l data-closed:translate-x-full",
        "w-full shadow-2xl md:w-[var(--panel-width,28rem)] md:max-w-[calc(100%-2rem)]",
        "absolute h-full",
        className,
      )}
    >
      {children}
    </TransitionChild>
  </Transition>
);
