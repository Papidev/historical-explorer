"use client";
// Three throwaway Type mappings layouts on /admin?prototype=type-mappings&variant=A|B|C.
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminPoiRow } from "../../lib/types";
import { IconButton } from "@/app/components/ui/IconButton";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { ListboxSelect } from "@/app/components/ui/ListboxSelect";
import { usePrototype } from "./usePrototype";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";
import { VisitorPreview } from "./VisitorPreview";

export const TypeMappingsPrototype = ({rows}:{rows:AdminPoiRow[]}) => {
  const model = usePrototype(rows);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const variant = ["A","B","C"].includes(params.get("variant") ?? "") ? params.get("variant")! : "A";
  const cycle = (direction:number) => {
    const next = new URLSearchParams(params.toString());
    next.set("variant", ["A","B","C"][( ["A","B","C"].indexOf(variant) + direction + 3) % 3]);
    router.replace(`${pathname}?${next}`,{scroll:false});
  };
  useEffect(() => {
    const onKey = (event:KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input,textarea,select,button,[role=combobox],[role=listbox],[role=option],[contenteditable]")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const next = new URLSearchParams(params.toString());
        next.set("variant", ["A","B","C"][( ["A","B","C"].indexOf(variant) + (event.key === "ArrowLeft" ? -1 : 1) + 3) % 3]);
        router.replace(`${pathname}?${next}`,{scroll:false});
      }
    };
    window.addEventListener("keydown",onKey);
    return () => window.removeEventListener("keydown",onKey);
  },[params,pathname,router,variant]);
  return <div className="min-h-0 flex-1 overflow-auto pb-24 text-gray-900"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-wide text-amber-700 uppercase">Throwaway prototype · Issue #60</p><h2 className="mt-1 text-xl font-semibold">Type mappings</h2><p className="mt-1 text-sm text-gray-500">Shared category rules for acquired Wikidata types.</p></div><div className="rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{model.types.length} types · {model.types.filter(type => type.status === "Unmapped").length} unmapped</div></div>
    <div className="mb-4 flex flex-wrap items-end gap-4"><label className="min-w-56 flex-1 text-sm font-medium">Search types<input className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-normal" placeholder="Type label or Q ID" value={model.query} onChange={event => model.setQuery(event.target.value)}/></label><div className="w-40"><ListboxSelect label="Rule state" value={model.status} onChange={model.setStatus} options={["All","Unmapped","Mapped","Ignored"].map(value => ({label:value,value}))}/></div></div>
    <p role="status" className="mb-4 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">{model.message}</p>
    {model.visibleTypes.length ? variant === "A" ? <VariantA model={model}/> : variant === "B" ? <VariantB model={model}/> : <VariantC model={model}/> : <p className="rounded-lg bg-white p-6 text-sm text-gray-500">No matching types.</p>}
    <details className="mt-5 text-sm text-gray-600"><summary className="cursor-pointer">Missing POI types ({model.missingTypes.length}) · POIs are retained</summary><ul className="mt-2 max-h-40 overflow-auto pl-4">{model.missingTypes.map(row => <li key={row.id}>{row.transformedPoi?.name ?? row.rawPoi?.name ?? row.id}</li>)}</ul></details>
    <VisitorPreview model={model}/>
    <details className="mt-4 text-xs text-gray-500"><summary className="cursor-pointer">Prototype state · variant {variant}</summary><pre className="mt-2 max-h-52 overflow-auto rounded-lg bg-gray-100 p-3">{JSON.stringify({variant,query:model.query,status:model.status,selectedType:model.selected?.id,rules:model.rules},null,2)}</pre></details>
    {process.env.NODE_ENV !== "production" && <nav aria-label="Prototype variants" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-5 rounded-full bg-gray-900 px-4 py-3 text-sm text-white shadow-xl"><IconButton label="Previous variant" onClick={() => cycle(-1)}><ArrowLeftIcon/></IconButton><span className="min-w-44 text-center">{variant} · {variant === "A" ? "Inline table" : variant === "B" ? "Split workspace" : "Classification queue"}</span><IconButton label="Next variant" onClick={() => cycle(1)}><ArrowRightIcon/></IconButton></nav>}
  </div>;
};
