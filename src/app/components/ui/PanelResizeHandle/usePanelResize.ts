import { useRef, type ButtonHTMLAttributes } from "react";

export const usePanelResize = (edge: "left" | "right", onResize: (width: number) => void) => {
  const drag = useRef<{ x: number; width: number } | null>(null);

  const resize = (width: number, handle: HTMLButtonElement) => {
    onResize(
      Math.max(
        256,
        Math.min(
          width,
          640,
          (handle.closest<HTMLElement>("[data-panel-container]")?.clientWidth ?? 640) - 32,
        ),
      ),
    );
  };

  return {
    onPointerDown: (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus();
      drag.current = {
        x: event.clientX,
        width: event.currentTarget.parentElement?.getBoundingClientRect().width ?? 448,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!drag.current) return;
      event.stopPropagation();
      resize(
        drag.current.width + (event.clientX - drag.current.x) * (edge === "right" ? 1 : -1),
        event.currentTarget,
      );
    },
    onLostPointerCapture: () => {
      drag.current = null;
    },
    onKeyDown: (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      resize(
        (event.currentTarget.parentElement?.getBoundingClientRect().width ?? 448) +
          (event.key === "ArrowRight" ? 16 : -16) * (edge === "right" ? 1 : -1),
        event.currentTarget,
      );
    },
  } satisfies ButtonHTMLAttributes<HTMLButtonElement>;
};
