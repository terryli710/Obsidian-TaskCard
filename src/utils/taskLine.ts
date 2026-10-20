export interface TaskLine {
  /** Exact source through the whitespace following the checkbox. */
  prefix: string;
  status: string;
  body: string;
  statusOffset: number;
  bodyOffset: number;
}

/** Markdown tabs advance to the next four-column stop. */
export function markdownColumn(text: string, initial = 0): number {
  let column = initial;
  for (const char of text) column += char === '\t' ? 4 - column % 4 : 1;
  return column;
}

/** Read a native Markdown task without normalizing its list or quote prefix. */
export function parseTaskLine(line: string): TaskLine | null {
  const match = /^([ \t]*(?:>[ \t]*)*(?:[-*+]|\d+[.)])[ \t]+\[)([^\]\r\n])(\][ \t]+)([^\r\n]*)/.exec(line);
  if (!match) return null;
  const bodyOffset = match[1].length + match[2].length + match[3].length;
  return {
    prefix: line.slice(0, bodyOffset),
    status: match[2],
    body: match[4],
    statusOffset: match[1].length,
    bodyOffset
  };
}

/** Indented continuation lines owned by a task, inside the same quote. */
export function countTaskDescriptionLines(lines: string[], taskIndex = 0): number {
  const source = lines[taskIndex] ?? '';
  if (!parseTaskLine(source)) return 0;
  const quotePrefix = source.match(/^[ \t]*(?:>[ \t]*)+/)?.[0] ?? '';
  const depth = (quotePrefix.match(/>/g) ?? []).length;
  const quote = new RegExp(`^[ \\t]*(?:>[ \\t]?){${depth}}`);
  const unwrap = (line: string) => depth ? line.replace(quote, '') : line;
  const indentation = (line: string) => markdownColumn(line.match(/^[ \t]*/)[0]);
  const unwrapped = unwrap(source);
  const task = parseTaskLine(unwrapped)!;
  const contentIndent = markdownColumn(unwrapped.slice(0, task.statusOffset - 1));
  let count = 0;
  for (let i = taskIndex + 1; i < lines.length; i++) {
    if (depth && !quote.test(lines[i])) break;
    const line = unwrap(lines[i]);
    if (!line.trim() || indentation(line) < contentIndent) break;
    count++;
  }
  return count;
}
