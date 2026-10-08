import { useRef, type TouchEvent } from "react";

export const useFilterSwipe = (direction: "left" | "right", onSwipe: () => void) => {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      start.current =
        event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : null;
    },
    onTouchMove: (event: TouchEvent<HTMLElement>) => {
      if (event.touches.length !== 1) start.current = null;
    },
    onTouchCancel: () => {
      start.current = null;
    },
    onTouchEnd: (event: TouchEvent<HTMLElement>) => {
      const origin = start.current;
      start.current = null;
      if (!origin || !event.changedTouches[0]) return;

      const x = event.changedTouches[0].clientX - origin.x;
      const y = event.changedTouches[0].clientY - origin.y;
      if (Math.abs(x) < 60 || Math.abs(x) <= Math.abs(y)) return;
      if (direction === "right" ? x > 0 : x < 0) onSwipe();
    },
  };
};
