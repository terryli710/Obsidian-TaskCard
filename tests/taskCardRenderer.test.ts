// TaskCardRenderer imports the Svelte adapter (and through it TaskItem.svelte),
// which only compiles in the jsdom component-test setup; stub it out here.
jest.mock('../src/renderer/postProcessor', () => ({
  TaskItemSvelteAdapter: class {}
}));

import { getLineNumbersOfListItem } from '../src/renderer/TaskCardRenderer';

/**
 * getLineNumbersOfListItem maps a rendered list item back to its [start, end)
 * line span inside the section markdown. The mocked obsidian.htmlToMarkdown
 * turns each item's innerHTML into markdown lines (<br> → newline).
 *
 * Regression focus (known-issues #3): blank lines that follow a list item
 * separate the item from the rest of the document — they must position the
 * NEXT item but never be folded into an item's own span, or a card edit
 * splices them away and merges the following paragraph into the list.
 */

const fakeUl = (itemInnerHTMLs: string[]) =>
  ({
    children: itemInnerHTMLs.map((innerHTML) => ({ innerHTML }))
  } as unknown as HTMLElement);

describe('getLineNumbersOfListItem', () => {
  it('maps items of a tight list to consecutive single-line spans', () => {
    const ul = fakeUl(['task one', 'task two']);
    const content = ['- [ ] task one', '- [ ] task two'].join('\n');
    expect(getLineNumbersOfListItem(ul, 0, content)).toEqual({
      startLine: 0,
      endLine: 1
    });
    expect(getLineNumbersOfListItem(ul, 1, content)).toEqual({
      startLine: 1,
      endLine: 2
    });
  });

  it('excludes the trailing blank line from an item span (known-issues #3)', () => {
    const ul = fakeUl(['task one', 'task two']);
    const content = [
      '- [ ] task one',
      '',
      '- [ ] task two',
      '',
      'A paragraph after the list.'
    ].join('\n');
    // previously {0, 2}: the blank separator was swallowed into the span,
    // so a card edit deleted it and merged the paragraph into the list
    expect(getLineNumbersOfListItem(ul, 0, content)).toEqual({
      startLine: 0,
      endLine: 1
    });
    // the blank line still positions the next item correctly...
    // ...and the last item's span also stops before its trailing blank
    expect(getLineNumbersOfListItem(ul, 1, content)).toEqual({
      startLine: 2,
      endLine: 3
    });
  });

  it('spans multi-line items (description lines) without trailing blanks', () => {
    const ul = fakeUl(['task one<br>first detail', 'task two']);
    const content = [
      '- [ ] task one',
      '    first detail',
      '',
      '- [ ] task two'
    ].join('\n');
    expect(getLineNumbersOfListItem(ul, 0, content)).toEqual({
      startLine: 0,
      endLine: 2
    });
    expect(getLineNumbersOfListItem(ul, 1, content)).toEqual({
      startLine: 3,
      endLine: 4
    });
  });
});
