import { protectMarkdownSyntax } from '../src/utils/markdownSyntax';
import { extractTags } from '../src/utils/regexUtils';
import { extractInlineFields } from '../src/taskModule/fieldSyntax';
import { stripTaskSyntaxForDisplay } from '../src/taskModule/fieldSyntax';

describe('protected Markdown metadata extraction', () => {
  it('keeps syntax-only task display fallback and checkbox delimiters intact', () => {
    const source = '- [ ] #TaskCard [due:: 2026-10-08] ^tc-x1y2z3';
    expect(stripTaskSyntaxForDisplay(source, 'TaskCard')).toBe(source);
    expect(protectMarkdownSyntax('- [ ] real task').text).toBe('- [ ] real task');
  });
  it('exposes standalone legacy fields only when requested, keeping outer literals protected', () => {
    const source = 'Read `%%* priority: 1 *%%` [link](https://example.com/%%*bad*%%) %% ordinary priority: 4 %% %%* priority: 2 *%%';
    const protectedSource = protectMarkdownSyntax(source, {
      legacyNotation: { start: '%%*', end: '*%%' }
    });
    expect(protectedSource.text).toContain('%%* priority: 2 *%%');
    expect(protectedSource.text).not.toContain('priority: 1');
    expect(protectedSource.text).not.toContain('priority: 4');
    expect(protectedSource.text).not.toContain('bad');
    expect(protectedSource.restore(protectedSource.text)).toBe(source);
    expect(protectMarkdownSyntax('%%* priority: 2 *%%').text).not.toContain('priority');
  });
  it.each([
    '$$x = #math [due:: literal]$$',
    '==important #highlight [due:: literal]==',
    '^[note #footnote [due:: literal]]',
    '^[due:: literal]',
    '[due:: literal][target]',
    '[due:: literal](https://example.com)',
    '[label #reference [due:: literal]][target]',
    '[label #collapsed [due:: literal]][]',
    '[label #shortcut]'
  ])('preserves %s while extracting only external metadata', literal => {
    const fields = extractInlineFields('Read ' + literal + ' #real [due:: 2026-10-21]');
    expect(fields.known).toEqual({ due: '2026-10-21' });
    const [tags, rest] = extractTags(fields.rest);
    expect(tags).toEqual(['#real']);
    expect(rest).toBe('Read ' + literal);
  });

  it('preserves multiline display math and source positions', () => {
    const source = 'before $$\nx = #math\n$$ after #real';
    const protectedSource = protectMarkdownSyntax(source);
    expect(protectedSource.text).not.toContain('#math');
    expect(protectedSource.contains(source.indexOf('#math'))).toBe(true);
    expect(protectedSource.restore(protectedSource.text)).toBe(source);
  });
});
