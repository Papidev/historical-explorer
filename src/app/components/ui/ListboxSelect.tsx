"use client";

import { Label, Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/16/solid";
import { CheckIcon } from "@heroicons/react/20/solid";

export type ListboxSelectOption = {
  label: string;
  value: string;
};

export const ListboxSelect = ({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: ListboxSelectOption[];
  value: string;
}) => {
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <Listbox value={selectedOption} onChange={(option) => onChange(option.value)}>
      <Label className="block text-sm/6 font-medium text-gray-900">{label}</Label>
      <div className="relative mt-2">
        <ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 sm:text-sm/6">
          <span className="col-start-1 row-start-1 truncate pr-6">
            {selectedOption?.label ?? ""}
          </span>
          <ChevronUpDownIcon
            aria-hidden="true"
            className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4"
          />
        </ListboxButton>

        <ListboxOptions
          transition
          className="absolute right-0 z-50 mt-1 max-h-60 w-max max-w-[calc(100vw-2rem)] min-w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg outline-1 outline-black/5 data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 sm:text-sm"
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option}
              className="group relative cursor-default py-2 pr-9 pl-3 text-gray-900 select-none data-focus:bg-indigo-600 data-focus:text-white data-focus:outline-hidden"
            >
              <span className="block font-normal whitespace-nowrap group-data-selected:font-semibold">
                {option.label}
              </span>

              <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600 group-not-data-selected:hidden group-data-focus:text-white">
                <CheckIcon aria-hidden="true" className="size-5" />
              </span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
};
