import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
};

/** Search box with a visible border, a search icon and a clear button. */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onValueChange, wrapperClassName, className, placeholder = "Search", ...props },
  ref,
) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-label-2" aria-hidden />
      <input
        ref={ref}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        aria-label={props["aria-label"] ?? placeholder}
        onChange={event => onValueChange(event.target.value)}
        className={cn(
          "h-11 w-full rounded-control border border-control bg-surface pl-10 pr-11 text-body text-label transition-colors placeholder:text-label-2 hover:border-label-2 focus:border-label [&::-webkit-search-cancel-button]:hidden",
          className,
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onValueChange("")}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-label-2 transition-colors hover:bg-fill-3 hover:text-label">
          <X className="size-4" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </div>
  );
});
