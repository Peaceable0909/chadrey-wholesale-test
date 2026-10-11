import * as React from "react";
import { siteConfig } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";

/*
 * The Chadrey logo, redrawn as a vector from the supplied artwork so it stays sharp at every size and costs a few
 * hundred bytes. The orange cart-shaped "C" keeps its orange gradient; the word "hadrey" takes the surrounding text
 * colour (deep navy on light pages, white on dark ones). The coordinates are the artwork's own, so one drawing serves
 * both the full logo and the mark on its own.
 */

const FULL_VIEWBOX = "150 262 1472 340";
const MARK_VIEWBOX = "150 262 470 340";
const ORANGE_TOP = "#ff931f";
const ORANGE_BOTTOM = "#ff5a12";

function Mark({ gradient }: { gradient: string }) {
  const fill = `url(#${gradient})`;
  return (
    <>
      {/* cart handle */}
      <path d="M265 296H336L392 436" fill="none" stroke={fill} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
      {/* the "C", open on the right like a basket */}
      <path d="M581.7 335A118 118 0 1 0 591.8 480L545.4 448.7A62 62 0 1 1 540.1 372.5Z" fill={fill} stroke={fill} strokeWidth={8} strokeLinejoin="round" />
      {/* speed lines */}
      <path d="M200 378L318 364.5A13.5 13.5 0 0 1 318 391.5Z" fill={fill} />
      <path d="M163 427L332 414A15 15 0 0 1 332 444Z" fill={fill} />
      <path d="M236 477L352 468A14 14 0 0 1 352 496Z" fill={fill} />
      {/* wheels */}
      <circle cx={433} cy={565} r={27} fill={fill} />
      <circle cx={545} cy={565} r={27} fill={fill} />
    </>
  );
}

function Wordmark({ gradient, clipLeft, clipRight }: { gradient: string; clipLeft: string; clipRight: string }) {
  return (
    <>
      <g fill="currentColor">
        <rect x={612} y={292} width={48} height={218} rx={6} />
        <rect x={906} y={341} width={49} height={169} rx={6} />
        <rect x={1088} y={292} width={49} height={218} rx={6} />
        <rect x={1152} y={341} width={48} height={169} rx={6} />
        <rect x={1290} y={416} width={98} height={32} />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth={50}>
        <path d="M636 428A55.5 63 0 0 1 747 428V510" />
        <circle cx={869} cy={428} r={62} />
        <circle cx={1051} cy={428} r={62} />
        <path d="M1176 452C1176 395 1200 366 1240 366" />
        <path d="M1373.7 472.1A57 64 0 1 1 1387 431" strokeWidth={46} />
        <path d="M1410 300L1488 490" clipPath={`url(#${clipLeft})`} transform="translate(12 0)" />
        <path d="M1580 300L1478 535Q1462 568 1426 570" clipPath={`url(#${clipRight})`} transform="translate(12 0)" />
      </g>
      {/* the leaf that tops the "y" */}
      <path d="M1536 402L1560 347Q1564 338 1574 338H1620L1597 390Q1584 405 1568 405H1536Z" fill={`url(#${gradient})`} />
    </>
  );
}

function Defs({ gradient, clipLeft, clipRight }: { gradient: string; clipLeft: string; clipRight: string }) {
  return (
    <defs>
      <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1={0} y1={278} x2={0} y2={594}>
        <stop offset={0} stopColor={ORANGE_TOP} />
        <stop offset={1} stopColor={ORANGE_BOTTOM} />
      </linearGradient>
      <clipPath id={clipLeft}>
        <rect x={1380} y={343} width={200} height={200} />
      </clipPath>
      <clipPath id={clipRight}>
        <rect x={1380} y={410} width={260} height={200} />
      </clipPath>
    </defs>
  );
}

function useIds() {
  const base = `logo-${React.useId().replace(/:/g, "")}`;
  return { gradient: `${base}-g`, clipLeft: `${base}-l`, clipRight: `${base}-r` };
}

/** The cart-shaped "C" on its own: app icon, sign-in screen, small spaces. */
export function LogoMark({ className }: { className?: string }) {
  const ids = useIds();
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden>
      <Defs {...ids} />
      <Mark gradient={ids.gradient} />
    </svg>
  );
}

/** The full Chadrey logo. Size it with height (for example `h-7`); the width follows. */
export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  const ids = useIds();
  if (!showName) return <LogoMark className={cn("h-8 w-auto shrink-0", className)} />;
  return (
    <svg viewBox={FULL_VIEWBOX} role="img" aria-label={siteConfig.shortName} className={cn("h-7 w-auto shrink-0 text-label", className)}>
      <Defs {...ids} />
      <Mark gradient={ids.gradient} />
      <Wordmark {...ids} />
    </svg>
  );
}
