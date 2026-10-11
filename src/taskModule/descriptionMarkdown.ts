import MarkdownIt from 'markdown-it';
import { stripTaskSyntaxForDisplay } from './fieldSyntax';

// Use the existing block parser only to locate real list items. Rendering
// stays with Obsidian, and fenced/indented code never passes through metadata
// stripping. Keeping line counts preserves native checkbox source mapping.
const blocks = new MarkdownIt();

export function descriptionTaskLines(source: string): number[] {
  const lines = source.split('\n');
  const taskLines: number[] = [];
  for (const token of blocks.parse(source, {})) {
    if (token.type === 'list_item_open' && token.map &&
        /^(?:\s*>\s*)*\s*(?:[-*+]|\d+[.)])\s+\[.\]\s+\S/.test(lines[token.map[0]])) taskLines.push(token.map[0]);
  }
  return taskLines;
}

export function descriptionMarkdownForDisplay(source: string, indicatorTag: string): string {
  const taskLines = new Set(descriptionTaskLines(source));
  return source.split('\n').map((line, index) =>
    taskLines.has(index) ? stripTaskSyntaxForDisplay(line, indicatorTag) : line
  ).join('\n');
}
