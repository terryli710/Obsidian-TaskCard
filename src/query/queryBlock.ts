export interface QueryBlockMatch {
  language: string;
  source: string;
}

/** Locate the current fence by content, never by a stale closing-line index. */
export function replaceQueryBlock(
  content: string, replacement: string, hint: number, expected: QueryBlockMatch
): string {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const normalize = (value: string) => value.replace(/\r\n/g, '\n').trim();
  const matches: { start: number; end: number; prefix: string }[] = [];
  for (let start = 0; start < lines.length; start++) {
    const opening = /^([ \t>]*)(`{3,}|~{3,})([^`~]*)$/.exec(lines[start]);
    if (!opening) continue;
    const [, prefix, fence, info] = opening;
    const close = new RegExp(`^${fence[0]}{${fence.length},}\\s*$`);
    let end = start + 1;
    for (; end < lines.length; end++) {
      const line = lines[end].startsWith(prefix) ? lines[end].slice(prefix.length) : lines[end];
      if (close.test(line.trim())) break;
    }
    if (end === lines.length) break;
    const source = lines.slice(start + 1, end)
      .map(line => line.startsWith(prefix) ? line.slice(prefix.length) : line).join('\n');
    if (info.trim().split(/\s+/)[0] === expected.language && normalize(source) === normalize(expected.source)) {
      matches.push({ start, end, prefix });
    }
    // An example nested inside a longer Markdown fence is not a live query.
    start = end;
  }
  const target = matches.find(block => block.start === hint) ?? (matches.length === 1 ? matches[0] : undefined);
  if (!target) throw new Error('The query block changed or could not be located unambiguously.');
  const body = replacement.split(/\r?\n/).slice(1, -1).map(line => target.prefix + line);
  lines.splice(target.start + 1, target.end - target.start - 1, ...body);
  return lines.join(eol);
}
