import { Fragment } from "react";

type Props = { text: string; className?: string };

function inline(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>);
}

export default function FormattedDescription({ text, className = "formatted-description" }: Props) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => { if (bullets.length) { blocks.push(<ul key={`list-${blocks.length}`}>{bullets.map((item, index) => <li key={`${item}-${index}`}>{inline(item)}</li>)}</ul>); bullets = []; } };
  lines.forEach((line, index) => { const trimmed = line.trim(); if (/^[-*•]\s+/.test(trimmed)) bullets.push(trimmed.replace(/^[-*•]\s+/, "")); else { flush(); if (trimmed) blocks.push(<p key={`paragraph-${index}`}>{inline(trimmed)}</p>); } });
  flush();
  return <div className={className}>{blocks.length ? blocks : <p>No description provided.</p>}</div>;
}
