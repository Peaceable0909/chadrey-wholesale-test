export type FormatKind = "bold" | "bullet";

/**
 * Applies the description toolbar to the selected text.
 * Descriptions are plain text with **bold** and "- " bullet lines (see FormattedDescription).
 */
export function applyFormat(text: string, start: number, end: number, kind: FormatKind): { text: string; selectionStart: number; selectionEnd: number } {
  const selected = text.slice(start, end);

  if (kind === "bold") {
    const inner = selected || "important detail";
    const replacement = `**${inner}**`;
    return {
      text: `${text.slice(0, start)}${replacement}${text.slice(end)}`,
      selectionStart: start + 2,
      selectionEnd: start + 2 + inner.length,
    };
  }

  // Bullets act on whole lines: grow the selection to line boundaries so a half-selected line is handled too.
  const lineStart = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = text.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const block = text.slice(lineStart, lineEnd) || "bullet point";
  const replacement = block
    .split(/\r?\n/)
    .map(line => (line.trim() === "" || /^\s*[-*•]\s+/.test(line) ? line : `- ${line}`))
    .join("\n");
  return {
    text: `${text.slice(0, lineStart)}${replacement}${text.slice(lineEnd)}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + replacement.length,
  };
}
