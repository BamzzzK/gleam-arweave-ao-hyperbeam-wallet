import * as React from "react";
import { cn } from "./cn";

export type SearchFieldProps = React.InputHTMLAttributes<HTMLInputElement>;

/** A borderless search input led by a magnifier; the whole row focuses the input. */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(({ className, ...props }, ref) => (
  <label className={cn("flex items-center gap-2.5 text-faint", className)}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <input
      ref={ref}
      type="search"
      className="min-w-0 flex-1 border-0 bg-transparent px-0 py-2.5 text-label text-foreground placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      {...props}
    />
  </label>
));
SearchField.displayName = "SearchField";
