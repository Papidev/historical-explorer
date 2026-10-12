import { useCallback } from "react";

export const useAutoScroll = <T extends HTMLElement>() =>
  useCallback((element: T | null) => {
    if (!element) return;
    const scrollToBottom = () => {
      element.scrollTop = element.scrollHeight;
    };
    scrollToBottom();
    const observer = new MutationObserver(scrollToBottom);
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);
