import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";

export const Search = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="grid w-full grid-cols-1 sm:w-64">
    <span className="sr-only">Search POIs by name</span>
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search POIs by name"
      className="col-start-1 row-start-1 block w-full rounded-md bg-white py-1.5 pr-3 pl-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:pl-9 sm:text-sm/6"
    />
    <MagnifyingGlassIcon
      aria-hidden="true"
      className="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-gray-400 sm:size-4"
    />
  </label>
);
