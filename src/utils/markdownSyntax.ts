/** Protect inline Markdown while extracting TaskCard metadata. This only
 * separates literal/link syntax from task fields; Obsidian renders Markdown.
 * Placeholders also retain spaces inside code while task fields normalize.
 */
function inlineLinkRanges(source: string) {
  const ranges: Array<{ from: number; to: number }> = [];
  function closingDelimiter(from: number, open: string, close: string, codeInLabel = false) {
    let depth = 1;
    for (let i = from + 1; i < source.length; i++) {
      if (source[i] === '\n') return -1;
      if (source[i] === '\\') { i++; continue; }
      if (codeInLabel && source[i] === '`') {
        const code = source.slice(i).match(/^(`+)(?!`)[^\n]*?(?<!`)\1(?!`)/);
        if (code) { i += code[0].length - 1; continue; }
      }
      if (source[i] === open) depth++;
      if (source[i] === close && --depth === 0) return i;
    }
    return -1;
  }
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\\') { i++; continue; }
    if (source[i] !== '[') continue;
    const labelEnd = closingDelimiter(i, '[', ']', true);
    if (labelEnd < 0 || source[labelEnd + 1] !== '(') continue;
    const destinationEnd = closingDelimiter(labelEnd + 1, '(', ')');
    if (destinationEnd < 0) continue;
    ranges.push({ from: source[i - 1] === '!' ? i - 1 : i, to: destinationEnd + 1 });
    i = destinationEnd;
  }
  return ranges;
}

export function protectMarkdownSyntax(source: string) {
  const fragments: string[] = [];
  const ranges: Array<{ from: number; to: number }> = [];
  let prefix = '\uE000';
  while (source.includes(prefix)) prefix += '\uE000';
  // Backtick delimiters must have the same length. Link destinations support
  // parentheses, wikilinks include aliases/anchors, and escapes are literal.
  const protectedSyntax = /\\[\s\S]|(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)|!?\[\[(?:\\.|[^\]])*\]\]|%%[\s\S]*?%%|<!--[\s\S]*?-->|<[^>\n]+>|https?:\/\/[^\s<>\])]+|(?<!\$)\$(?!\$)(?:\\.|[^$\n])+\$(?!\$)/g;
  const candidates = [...source.matchAll(protectedSyntax)].map(match => ({ from: match.index!, to: match.index! + match[0].length }));
  candidates.push(...inlineLinkRanges(source));
  candidates.sort((a, b) => a.from - b.from || b.to - a.to);
  let text = '';
  let cursor = 0;
  for (const range of candidates) {
    if (range.from < cursor) continue;
    const fragment = source.slice(range.from, range.to);
    ranges.push(range);
    const index = fragments.push(fragment) - 1;
    text += source.slice(cursor, range.from) + `${prefix}${index}\uE001`;
    cursor = range.to;
  }
  text += source.slice(cursor);
  return {
    text,
    contains(position: number) { return ranges.some(range => range.from <= position && position < range.to); },
    restore(value: string) {
      return value.replace(new RegExp(`${prefix}(\\d+)\uE001`, 'g'), (_, index) => fragments[Number(index)]);
    }
  };
}

/** Dataview scans innerHTML for fields, even inside code. Shield its delimiter
 * during native rendering, then restore only code text after postprocessing.
 * The stored source and rendered formatting remain untouched.
 */
export function protectCodeFields(source: string) {
  let marker = '\uE002';
  while (source.includes(marker)) marker += '\uE002';
  return {
    markdown: source.replace(/\\[\s\S]|(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g,
      fragment => fragment.startsWith('`') && !fragment.includes('\n')
        ? fragment.replace(/::/g, marker) : fragment),
    restore(host: HTMLElement) {
      for (const code of host.querySelectorAll('code')) {
        const walker = host.ownerDocument.createTreeWalker(code, 4 /* SHOW_TEXT */);
        let text: Node | null;
        while ((text = walker.nextNode())) text.nodeValue = text.nodeValue!.split(marker).join('::');
      }
    }
  };
}
