import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared look for filled iOS-style inputs. 16px+ text so iOS Safari never zooms on focus. */
export const inputClass =
  "block w-full rounded-control bg-fill-3 px-4 text-body text-label outline-none transition-colors placeholder:text-label-2 focus:bg-fill-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/40 disabled:opacity-50 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-ios-red/50";

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, "h-12", className)} {...props} />;
});

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(inputClass, "min-h-28 resize-y py-3 leading-snug", className)} {...props} />;
});

/** Native select (so iPhones show their own picker) with a custom chevron. */
export const SelectInput = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function SelectInput(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputClass, "h-12 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-label-2" aria-hidden />
    </div>
  );
});

type FieldProps = {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: boolean;
  /** Use "div" when the control is a group of buttons rather than a single input. */
  as?: "label" | "div";
  className?: string;
  children: React.ReactNode;
};

/** Label above a control, with optional hint and error text. */
export function Field({ label, hint, error, optional, as: Wrapper = "label", className, children }: FieldProps) {
  return (
    <Wrapper className={cn("block", className)}>
      <span className="mb-1.5 block text-subhead font-medium text-label">
        {label}
        {optional && <span className="ml-1.5 font-normal text-label-2">Optional</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-footnote text-label-2">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1.5 block text-footnote font-medium text-ios-red-text">
          {error}
        </span>
      )}
    </Wrapper>
  );
}

type FormSectionProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** White card of stacked fields under a small uppercase title. */
export function FormSection({ title, description, className, children }: FormSectionProps) {
  return (
    <section className={className}>
      {title && <h2 className="px-4 pb-2 text-footnote font-medium uppercase tracking-wide text-label-2">{title}</h2>}
      <div className="space-y-4 rounded-group bg-surface p-4">{children}</div>
      {description && <p className="px-4 pt-2 text-footnote text-label-2">{description}</p>}
    </section>
  );
}
