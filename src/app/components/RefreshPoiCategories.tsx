"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const RefreshPoiCategories = ({ city }: { city: string }) => {
  const router = useRouter();
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("poi-type-mappings");
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (Array.isArray(event.data) && event.data.includes(city)) router.refresh();
    };
    return () => channel.close();
  }, [city, router]);
  return null;
};
