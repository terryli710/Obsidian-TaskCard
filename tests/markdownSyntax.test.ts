import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RegExpValidator } from '@eslint-community/regexpp';
import ts from 'typescript';
import { protectCodeFields, protectMarkdownSyntax } from '../src/utils/markdownSyntax';
import { extractTags } from '../src/utils/regexUtils';
import { extractInlineFields } from '../src/taskModule/fieldSyntax';
import { stripTaskSyntaxForDisplay } from '../src/taskModule/fieldSyntax';

describe('protected Markdown metadata extraction', () => {
  it('uses regex literals supported before ECMAScript 2018 lookbehind', () => {
    const validator = new RegExpValidator({ ecmaVersion: 2017 });
    const failures: string[] = [];
    let literalCount = 0;
    for (const filename of ['markdownSyntax.ts', 'markdownSourceContext.ts']) {
      const path = resolve(__dirname, '../src/utils', filename);
      const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
          literalCount++;
          const literal = node.getText(source);
          try {
            validator.validateLiteral(literal);
          } catch (error) {
            const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
            failures.push(`${filename}:${line + 1}:${character + 1}: ${String(error)}`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }

    expect(literalCount).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });

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

  it.each([
    '``text ` #hidden [due:: literal]``',
    '```text `` and ` #hidden [due:: literal]```',
    '$x = #hidden [due:: literal]$',
    '$$x $y$ = #hidden [due:: literal]$$',
    '$x = \\$ #hidden [due:: literal]$'
  ])('protects complete delimiter runs in %s', literal => {
    const source = `${literal} #real [due:: 2026-10-21]`;
    const protectedSource = protectMarkdownSyntax(source);

    expect(protectedSource.contains(source.indexOf('#hidden'))).toBe(true);
    expect(protectedSource.contains(source.indexOf('#real'))).toBe(false);
    expect(protectedSource.restore(protectedSource.text)).toBe(source);
    const fields = extractInlineFields(source);
    expect(fields.known).toEqual({ due: '2026-10-21' });
    expect(extractTags(fields.rest)).toEqual([['#real'], literal]);
  });

  it.each([
    '`` #visible `',
    '\\` #visible',
    '$ #visible',
    '\\$ #visible',
    '$\n#visible$',
    '$$$ #visible $$$'
  ])('keeps metadata exposed after unmatched or escaped delimiters in %s', prefix => {
    const source = `${prefix} [due:: 2026-10-21]`;
    const protectedSource = protectMarkdownSyntax(source);

    expect(protectedSource.contains(source.indexOf('#visible'))).toBe(false);
    expect(protectedSource.restore(protectedSource.text)).toBe(source);
    expect(extractInlineFields(source).known).toEqual({ due: '2026-10-21' });
    expect(extractTags(source)[0]).toEqual(['#visible']);
  });

  it('keeps a shortcut indicator link protected while exposing the next indicator', () => {
    const source = '[#TaskCard] #TaskCard';
    const protectedSource = protectMarkdownSyntax(source);

    expect(protectedSource.contains(1)).toBe(true);
    expect(protectedSource.contains(12)).toBe(false);
    expect(extractTags(source)).toEqual([['#TaskCard'], '[#TaskCard]']);
    expect(protectedSource.restore(protectedSource.text)).toBe(source);
  });
});

describe('code field shielding', () => {
  it('shields fields inside complete multi-backtick spans while preserving external fields', () => {
    const source = 'Read ``text ` [due:: literal]`` [due:: 2026-10-21]';
    const protectedSource = protectCodeFields(source);

    expect(protectedSource.markdown).not.toContain('[due:: literal]');
    expect(protectedSource.markdown).toContain('[due:: 2026-10-21]');
    expect(protectedSource.markdown.startsWith('Read ``text ` [due')).toBe(true);
  });

  it.each([
    'Read \\`[due:: literal]` [due:: 2026-10-21]',
    'Read ``[due:: literal]` [due:: 2026-10-21]',
    'Read `line one\n[due:: literal]` [due:: 2026-10-21]'
  ])('preserves escaped, unmatched and multiline code fields in %s', source => {
    expect(protectCodeFields(source).markdown).toBe(source);
  });
});
