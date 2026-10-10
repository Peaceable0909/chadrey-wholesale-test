import { initialsFrom, cn } from "@/lib/utils";

type AvatarProps = {
  name?: string | null;
  email?: string | null;
  className?: string;
};

/** Initials in a tinted circle. */
export function Avatar({ name, email, className }: AvatarProps) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-tint-soft text-footnote font-semibold text-tint-text", className)}>
      {initialsFrom(name, email)}
    </span>
  );
}
