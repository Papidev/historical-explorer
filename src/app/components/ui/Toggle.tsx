"use client";

export const Toggle = ({
  checked,
  description,
  id,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  name: string;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 inset-ring inset-ring-gray-900/5 outline-offset-2 outline-indigo-600 transition-colors duration-200 ease-in-out has-checked:bg-indigo-600 has-focus-visible:outline-2 dark:bg-white/5 dark:inset-ring-white/10 dark:outline-indigo-500 dark:has-checked:bg-indigo-500">
      <span className="size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked:translate-x-5" />
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-description`}
        className="absolute inset-0 size-full cursor-pointer appearance-none focus:outline-hidden"
      />
    </div>
    <div className="text-sm">
      <label id={`${id}-label`} htmlFor={id} className="font-medium text-gray-900">
        {label}
      </label>{" "}
      <span id={`${id}-description`} className="text-gray-500">
        {description}
      </span>
    </div>
  </div>
);
