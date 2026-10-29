import { useState } from "react";
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Label } from "@headlessui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import type { Poi } from "@/types/Poi";

export const Search = ({ pois, onSelect }: { pois: Poi[]; onSelect: (poi: Poi) => void }) => {
  const [query, setQuery] = useState("");
  const matches = query.trim()
    ? pois.filter((poi) =>
        poi.name
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .toLowerCase()
          .includes(query.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()),
      )
    : [];

  return (
    <Combobox
      as="div"
      value={null}
      onChange={(poi: Poi | null) => {
        if (poi) onSelect(poi);
        setQuery("");
      }}
      onClose={() => setQuery("")}
    >
      <Label className="block text-sm font-semibold text-zinc-800">Search</Label>
      <div className="relative mt-2">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-3 left-3 size-5 text-zinc-400"
        />
        <ComboboxInput
          autoComplete="off"
          placeholder="Search by name"
          displayValue={() => ""}
          onChange={(event) => setQuery(event.target.value)}
          className="block min-h-11 w-full rounded-lg bg-white py-2.5 pr-3 pl-10 text-base text-zinc-900 outline-1 -outline-offset-1 outline-zinc-300 placeholder:text-zinc-400 focus:outline-2 focus:-outline-offset-2 focus:outline-yellow-700 sm:text-sm"
        />
      </div>
      <ComboboxOptions
        anchor="bottom start"
        className="z-50 max-h-72 w-(--input-width) overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg [--anchor-gap:0.25rem] empty:invisible"
      >
        {query.trim() && !matches.length && (
          <p className="px-3 py-3 text-sm text-zinc-500">No places match your search.</p>
        )}
        {matches.map((poi) => (
          <ComboboxOption
            key={poi.id}
            value={poi}
            className="group cursor-pointer rounded-md px-3 py-2.5 text-zinc-900 select-none data-focus:bg-yellow-100 data-focus:outline-hidden"
          >
            <span className="block text-sm font-medium">{poi.name}</span>
            <span className="mt-1 block text-xs text-zinc-500">
              {[poi.address, poi.city].filter(Boolean).join(" · ")}
            </span>
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  );
};
