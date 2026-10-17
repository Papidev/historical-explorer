import { XMarkIcon } from "@heroicons/react/24/outline";

export const DrawerCloseButton = ({
  label = "Close",
  onClick,
  transparent = false,
}: {
  label?: string;
  onClick: () => void;
  transparent?: boolean;
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
  >
    <span
      className={`flex size-7 items-center justify-center rounded-md ${transparent ? "" : "bg-white"}`}
    >
      <XMarkIcon aria-hidden="true" className="size-4" />
    </span>
  </button>
);
