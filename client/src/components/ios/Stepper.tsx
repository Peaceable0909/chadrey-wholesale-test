import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name, e.g. "Quantity". */
  label: string;
  className?: string;
};

/** Larger jumps for bigger minimum orders so wholesale quantities are quick to set. */
export function stepForMoq(moq: number): number {
  if (moq >= 500) return 50;
  if (moq >= 100) return 10;
  if (moq >= 20) return 5;
  return 1;
}

/** Quantity control: minus / typed number / plus, clamped to a range when editing finishes. */
export function Stepper({ value, onChange, min = 1, max = 1_000_000, step = 1, label, className }: StepperProps) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(/[,\s]/g, ""));
    onChange(raw.trim() !== "" && Number.isFinite(parsed) ? clamp(parsed) : value);
    setDraft(null);
  };

  return (
    <div role="group" aria-label={label} className={cn("inline-flex h-11 items-center rounded-full bg-fill-3", className)}>
      <button
        type="button"
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className="press grid size-11 place-items-center rounded-full text-tint-text disabled:text-label-3">
        <Minus className="size-5" />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft ?? String(value)}
        onChange={event => setDraft(event.target.value)}
        onFocus={event => event.target.select()}
        onBlur={event => commit(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="h-full w-[4.5rem] min-w-0 bg-transparent text-center text-headline font-semibold tabular-nums outline-none"
      />
      <button
        type="button"
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className="press grid size-11 place-items-center rounded-full text-tint-text disabled:text-label-3">
        <Plus className="size-5" />
      </button>
    </div>
  );
}
