import MarkdownIt from 'markdown-it';
import { parseTaskLine } from './taskLine';

const blocks = new MarkdownIt();
const blank = (text: string) => text.replace(/[^\r\n]/g, ' ');

/** Locate actual source list items, retaining UTF-16 line/column geometry.
 * Markdown's block parser owns list nesting, callouts/quotes and code fences;
 * mask Obsidian's additional frontmatter and comment syntax before discovery.
 */
export function markdownSourceContext(lines: readonly string[]) {
  const visibleLines = [...lines];
  if (/^\uFEFF?---\s*$/.test(lines[0] ?? '')) {
    let end = 1;
    while (end < lines.length && !/^(?:---|\.\.\.)\s*$/.test(lines[end])) end++;
    for (let i = 0; i <= Math.min(end, lines.length - 1); i++) visibleLines[i] = blank(lines[i]);
  }
  const source = visibleLines.join('\n');
  const starts: number[] = [];
  let offset = 0;
  for (const line of visibleLines) { starts.push(offset); offset += line.length + 1; }
  let inlineBlocks: Array<{from: number; to: number}>;
  let code: Array<{from: number; to: number}>;
  const updateBlocks = (visible: string) => {
    const tokens = blocks.parse(visible, {});
    inlineBlocks = tokens.filter(token => token.type === 'inline' && token.map)
      .map(token => ({ from: starts[token.map![0]], to: starts[token.map![1]] ?? source.length }));
    code = tokens.filter(token => (token.type === 'fence' || token.type === 'code_block') && token.map)
      .map(token => ({ from: starts[token.map![0]], to: starts[token.map![1]] ?? source.length }));
  };
  updateBlocks(source);

  const unsafeRewriteLines = new Set<number>();
  let codeIndex = 0;
  let masked = '';
  for (let i = 0; i < source.length;) {
    while (codeIndex < code.length && code[codeIndex].to <= i) codeIndex++;
    const codeRange = code[codeIndex];
    if (codeRange && codeRange.from <= i) {
      masked += source.slice(i, codeRange.to);
      i = codeRange.to;
      continue;
    }
    if (source[i] === '\\') { masked += source.slice(i, i + 2); i += 2; continue; }
    if (source[i] === '`') {
      // Code spans belong to one Markdown inline block. A stray backtick in
      // an earlier paragraph must not consume a later comment delimiter.
      const block = inlineBlocks.find(range => range.from <= i && i < range.to);
      const inline = block && source.slice(i, block.to).match(/^(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/);
      if (inline) { masked += inline[0]; i += inline[0].length; continue; }
    }
    const close = source.startsWith('%%', i) ? '%%' : source.startsWith('<!--', i) ? '-->' : null;
    if (close) {
      const end = source.indexOf(close, i + (close === '%%' ? 2 : 4));
      const to = end < 0 ? source.length : end + close.length;
      // A comment can hide a fence opener the preliminary block parse saw.
      // That fence cannot suppress recognition of later comment delimiters.
      const hidesOpener = code.some(range => i <= range.from && range.from < to);
      // A line formatter cannot safely move fields/ids across a comment
      // whose closing delimiter lives on another line (or is still absent).
      if (end < 0 || source.slice(i, to).includes('\n')) {
        for (let index = 0; index < starts.length; index++) {
          if (starts[index] < to && (starts[index + 1] ?? source.length) > i) unsafeRewriteLines.add(index);
        }
      }
      masked += blank(source.slice(i, to));
      if (hidesOpener) {
        updateBlocks(masked + source.slice(to));
        codeIndex = 0;
      }
      i = to;
      continue;
    }
    masked += source[i++];
  }
  const maskedLines = masked.split('\n');
  const taskLines = new Set<number>();
  for (const token of blocks.parse(masked, {})) {
    if (token.type === 'list_item_open' && token.map && parseTaskLine(maskedLines[token.map[0]])) {
      taskLines.add(token.map[0]);
    }
  }
  return { taskLines, maskedLines, unsafeRewriteLines };
}
