import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
};

/** The rounded grey iOS search bar with a clear button. */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onValueChange, wrapperClassName, className, placeholder = "Search", ...props },
  ref,
) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-label-2" aria-hidden />
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
          "h-10 w-full rounded-[10px] bg-fill-3 pl-10 pr-10 text-body text-label outline-none transition-colors placeholder:text-label-2 focus:bg-fill-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/40 [&::-webkit-search-cancel-button]:hidden",
          className,
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onValueChange("")}
          className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-label-3 text-surface">
          <X className="size-3" strokeWidth={3} />
        </button>
      )}
    </div>
  );
});
