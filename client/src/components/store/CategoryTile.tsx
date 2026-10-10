import { Link } from "wouter";
import { categoryMeta } from "@/lib/categories";
import { toneSolid } from "@/components/ios/tone";
import { cn } from "@/lib/utils";

type CategoryTileProps = {
  name: string;
  count?: number;
  className?: string;
};

/** App-icon style category shortcut, like the icon grid at the top of a marketplace home. */
export function CategoryTile({ name, count, className }: CategoryTileProps) {
  const { icon: Icon, tone } = categoryMeta(name);
  return (
    <Link href={`/products?category=${encodeURIComponent(name)}`} className={cn("press group flex flex-col items-center gap-2 text-center", className)}>
      <span className={cn("grid size-[60px] place-items-center rounded-[19px] shadow-card transition-transform group-hover:scale-105", toneSolid[tone])}>
        <Icon className="size-[28px]" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="line-clamp-2 text-caption font-medium leading-tight">{name}</span>
      {count !== undefined && <span className="-mt-1.5 text-caption2 text-label-2">{count} {count === 1 ? "item" : "items"}</span>}
    </Link>
  );
}
