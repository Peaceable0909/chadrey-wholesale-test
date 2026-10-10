import { Fragment } from "react";
import { cn } from "@/lib/utils";

type Props = { text: string; className?: string; omitLeadingTitle?: string };

function inline(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>);
}

function headingText(value: string) {
  return value.replace(/^\*\*(.+)\*\*$/, "$1").replace(/:$/, "").trim();
}

/**
 * Renders the admin's plain-text description: **bold**, "- bullet" lines, and short "Label:" lines
 * as small headings. Anything else becomes a paragraph.
 */
export default function FormattedDescription({ text, className, omitLeadingTitle }: Props) {
  const lines = text.split(/\r?\n/);
  if (omitLeadingTitle && lines[0] && lines[0].replace(/\*/g, "").replace(/:$/, "").trim().toLowerCase() === omitLeadingTitle.trim().toLowerCase()) lines.shift();
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="list-disc space-y-1.5 pl-5 marker:text-label-3">
          {bullets.map((item, index) => <li key={`${item}-${index}`}>{inline(item)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) { flush(); return; }
    if (/^[-*•]\s+/.test(trimmed)) { bullets.push(trimmed.replace(/^[-*•]\s+/, "")); return; }
    flush();
    const isBoldHeading = /^\*\*[^*]+\*\*:?$/.test(trimmed);
    const isLabelHeading = /:$/.test(trimmed) && trimmed.length < 64 && !/[.!?]$/.test(trimmed);
    if (isBoldHeading || isLabelHeading) blocks.push(<h3 key={`heading-${index}`} className="pt-1 text-headline font-semibold">{inline(headingText(trimmed))}</h3>);
    else blocks.push(<p key={`paragraph-${index}`}>{inline(trimmed)}</p>);
  });
  flush();
  return <div className={cn("space-y-3 text-body leading-relaxed text-label", className)}>{blocks.length ? blocks : <p className="text-label-2">No description provided.</p>}</div>;
}
