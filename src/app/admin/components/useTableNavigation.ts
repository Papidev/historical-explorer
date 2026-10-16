import { useOptimistic, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TableQuery } from "../lib/tableQueries";

export const useTableNavigation = (query: TableQuery, prefix: "poi" | "people") => {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(query);

  return {
    query: optimisticQuery,
    isPending,
    update: (change: Partial<TableQuery>) => {
      const next = { ...optimisticQuery, ...change, page: change.page ?? 0 };
      const search = new URLSearchParams(params.toString());
      search.set(`${prefix}Page`, String(next.page + 1));
      search.set(`${prefix}Search`, next.search);
      if (prefix === "poi") {
        search.set("poiSort", next.sort);
        search.set("poiStatuses", next.statuses.join(","));
      }
      startTransition(() => {
        setOptimisticQuery(next);
        router.replace(`/admin?${search}`, { scroll: false });
      });
    },
  };
};
