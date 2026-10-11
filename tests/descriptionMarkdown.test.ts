import { descriptionMarkdownForDisplay } from '../src/taskModule/descriptionMarkdown';
import { extractInlineFields } from '../src/taskModule/fieldSyntax';

test('URL-valued metadata preserves field delimiters and foreign fields', () => {
  expect(extractInlineFields('Read [project:: https://example.com] [reference:: https://example.com/#Details]'))
    .toEqual({ known: { project: 'https://example.com' }, foreign: ['[reference:: https://example.com/#Details]'], rest: 'Read' });
});

test('description display strips only real subtask metadata and preserves fenced program source', () => {
  const source = [
    'Plain text [due:: tomorrow] #TaskCard',
    '- [ ] Follow up #TaskCard [due:: tomorrow] ^tc-abcdef',
    '    - [ ] Nested #TaskCard ^tc-ghijkl',
    '```dataviewjs',
    'dv.paragraph("[due:: tomorrow] #TaskCard");',
    '- [ ] literal #TaskCard ^tc-mnopqr',
    '```',
    '',
    '    - [ ] indented code #TaskCard ^tc-stuvwx'
  ].join('\n');
  const result = descriptionMarkdownForDisplay(source, 'TaskCard');
  expect(result).toBe(source
    .replace('- [ ] Follow up #TaskCard [due:: tomorrow] ^tc-abcdef', '- [ ] Follow up')
    .replace('    - [ ] Nested #TaskCard ^tc-ghijkl', '    - [ ] Nested'));
  expect(result.split('\n')).toHaveLength(source.split('\n').length);
});
