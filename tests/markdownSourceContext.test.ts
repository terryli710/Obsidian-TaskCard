import { markdownSourceContext } from '../src/utils/markdownSourceContext';

describe('Markdown task source geometry', () => {
  it.each([['<!--', '-->'], ['%%', '%%']])('does not pair backticks across blocks before a %s comment', (open, close) => {
    const source = ['A stray ` in paragraph', '', open, '- [ ] Hidden #TaskCard', '`', close];
    expect([...markdownSourceContext(source).taskLines]).toEqual([]);
  });
  it.each([['<!--', '-->'], ['%%', '%%']])('ignores a fence opener hidden inside a %s comment', (open, close) => {
    const source = [open, '```', close, '', open, '- [ ] Hidden #TaskCard', close, '```'];
    expect([...markdownSourceContext(source).taskLines]).toEqual([]);
  });
  it('recomputes inline blocks after a comment removes a fence opener', () => {
    const source = ['%%', '```', '%%', '- [ ] Read `%%` #TaskCard', '- [ ] Other #TaskCard'];
    const context = markdownSourceContext(source);
    expect([...context.taskLines]).toEqual([3, 4]);
    expect(context.unsafeRewriteLines.has(3)).toBe(false);
    expect(context.unsafeRewriteLines.has(4)).toBe(false);
  });
  it('uses block maps for nested lists, blockquotes and callouts, excluding indented code', () => {
    const source = [
      '    - [ ] indented code #TaskCard', '',
      '- [ ] parent #TaskCard', '    - [ ] child #TaskCard', '',
      '> [!note]', '> - [ ] quoted #TaskCard', '> > + [?] nested quote #TaskCard', '',
      '> ~~~~md', '> - [ ] fenced #TaskCard', '> ~~~', '> - [ ] still fenced #TaskCard', '> ~~~~',
      '- [ ] outside #TaskCard'
    ];
    expect([...markdownSourceContext(source).taskLines]).toEqual([2, 3, 6, 7, 14]);
  });

  it('does not start comments from code spans, escaped delimiters or fenced examples', () => {
    const source = [
      '- [ ] Read `%%` #TaskCard', '- [ ] escaped \\%% #TaskCard',
      '```', '%%', '```', '- [ ] still visible #TaskCard'
    ];
    const context = markdownSourceContext(source);
    expect([...context.taskLines]).toEqual([0, 1, 5]);
    expect(context.maskedLines).toEqual(source);
  });

  it('preserves UTF-16 geometry while masking frontmatter and comments', () => {
    const source = ['\uFEFF---', 'example: |', '  - [ ] 🔥 #TaskCard', '...',
      '- [ ] real 🔥 %% #hidden', '- [ ] hidden #TaskCard', '%% #outside'];
    const context = markdownSourceContext(source);
    expect([...context.taskLines]).toEqual([4]);
    expect(context.maskedLines.map(line => line.length)).toEqual(source.map(line => line.length));
    expect(context.maskedLines[4]).toBe('- [ ] real 🔥' + ' '.repeat(11));
    expect(context.maskedLines[6]).toBe('   #outside');
  });
});
