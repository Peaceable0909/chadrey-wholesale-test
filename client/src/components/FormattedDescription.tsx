import { Fragment } from "react";

type Props = { text: string; className?: string; omitLeadingTitle?: string };

function inline(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>);
}

function headingText(value: string) {
  return value.replace(/^\*\*(.+)\*\*$/, "$1").replace(/:$/, "").trim();
}

export default function FormattedDescription({ text, className = "formatted-description", omitLeadingTitle }: Props) {
  const lines = text.split(/\r?\n/);
  if (omitLeadingTitle && lines[0] && lines[0].replace(/\*/g, "").replace(/:$/, "").trim().toLowerCase() === omitLeadingTitle.trim().toLowerCase()) lines.shift();
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => { if (bullets.length) { blocks.push(<ul key={`list-${blocks.length}`}>{bullets.map((item, index) => <li key={`${item}-${index}`}>{inline(item)}</li>)}</ul>); bullets = []; } };
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) { flush(); return; }
    if (/^[-*•]\s+/.test(trimmed)) { bullets.push(trimmed.replace(/^[-*•]\s+/, "")); return; }
    flush();
    const isBoldHeading = /^\*\*[^*]+\*\*:?$/.test(trimmed);
    const isLabelHeading = /:$/.test(trimmed) && trimmed.length < 64 && !/[.!?]$/.test(trimmed);
    if (isBoldHeading || isLabelHeading) blocks.push(<h3 key={`heading-${index}`}>{inline(headingText(trimmed))}</h3>);
    else blocks.push(<p key={`paragraph-${index}`}>{inline(trimmed)}</p>);
  });
  flush();
  return <div className={className}>{blocks.length ? blocks : <p>No description provided.</p>}</div>;
}
