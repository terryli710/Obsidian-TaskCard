import { stripTaskSyntaxForDisplay } from '../src/taskModule/fieldSyntax';

describe('stripTaskSyntaxForDisplay', () => {
  it.each([
    [
      '- [ ] Child subtask one #TaskCard [due:: 2026-10-08] ^tc-mqz4hq',
      '- [ ] Child subtask one'
    ],
    [
      '- [ ] Child two #errand #TaskCard [priority:: medium] ^tc-bpieap',
      '- [ ] Child two #errand'
    ],
    ['    - [x] Grandchild #TaskCard ^tc-ap37g0', '    - [x] Grandchild'],
    ['- [ ] paren field (repeat:: every week) kept text', '- [ ] paren field kept text'],
    ['- plain description line', '- plain description line']
  ])('%s', (line, expected) => {
    expect(stripTaskSyntaxForDisplay(line, 'TaskCard')).toBe(expected);
  });

  it('keeps tags that only start with the indicator tag', () => {
    expect(stripTaskSyntaxForDisplay('- [ ] a #TaskCardish', 'TaskCard')).toBe(
      '- [ ] a #TaskCardish'
    );
  });

  it('leaves a syntax-only subtask as written so it keeps its checkbox', () => {
    const line = '- [ ] #TaskCard [due:: 2026-10-08] ^tc-x1y2z3';
    expect(stripTaskSyntaxForDisplay(line, 'TaskCard')).toBe(line);
  });

  it('keeps the line count so rendered rows map to source lines', () => {
    const text = '- [ ] a #TaskCard\n    - [ ] b [due:: 2026-01-01]\n- c';
    const out = text
      .split('\n')
      .map((l) => stripTaskSyntaxForDisplay(l, 'TaskCard'))
      .join('\n');
    expect(out.split('\n')).toHaveLength(3);
  });
});
