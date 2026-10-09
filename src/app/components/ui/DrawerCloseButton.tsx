import { XMarkIcon } from "@heroicons/react/24/outline";

export const DrawerCloseButton = ({
  label = "Close",
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="shrink-0 cursor-pointer rounded-md bg-white p-2 text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
  >
    <XMarkIcon aria-hidden="true" className="size-6" />
  </button>
);
