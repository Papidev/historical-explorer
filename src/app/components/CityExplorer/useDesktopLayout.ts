import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};

export const useDesktopLayout = () =>
  useSyncExternalStore(
    subscribe,
    () => window.innerWidth >= 1024,
    () => false,
  );
