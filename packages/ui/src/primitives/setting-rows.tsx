import { useId } from "react";
import { cn } from "./cn";

/**
 * Rows for a list of settings that change in place, without opening
 * another screen: `SelectRow` picks one of a few values, `ToggleRow` turns
 * a setting on or off. They line up with `OptionRow`, which opens one.
 */
export function SelectRow<T extends string>({
  title,
  value,
  options,
  disabled,
  onChange,
}: {
  title: string;
  value: T;
  options: { value: T; label: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex w-full items-center justify-between gap-3 py-3.5">
      <label htmlFor={id} className="text-label font-semibold text-foreground">
        {title}
      </label>
      {/* Reads like the value on an option row: no box, just the choice and a chevron. The native
          arrow ignores padding, so it's hidden and drawn here with room on the right. */}
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as T)}
          className="cursor-pointer appearance-none rounded-md bg-transparent py-1 pl-2 pr-6 text-right text-label text-muted hover:enabled:bg-mist hover:enabled:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-foreground disabled:cursor-default disabled:opacity-60"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-faint"
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export function ToggleRow({
  title,
  checked,
  disabled,
  onToggle,
}: {
  title: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center justify-between py-3.5 text-left disabled:opacity-60"
    >
      <span className="text-label font-semibold text-foreground">{title}</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-foreground" : "bg-line",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[2px]",
          )}
        />
      </span>
    </button>
  );
}
