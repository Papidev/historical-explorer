import { useEffect, useRef } from "react";

export const useAutoScroll = <T extends HTMLElement>() => {
  const scrollRef = useRef<T>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const scrollToBottom = () => {
      element.scrollTop = element.scrollHeight;
    };
    scrollToBottom();
    const observer = new MutationObserver(scrollToBottom);
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return scrollRef;
};
