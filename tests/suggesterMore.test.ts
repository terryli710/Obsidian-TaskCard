import { writable } from 'svelte/store';
import { AttributeSuggester } from '../src/autoSuggestions/Suggester';

function makeStore(projects: any = [
  { id: 'bookclub', name: 'BookClub', color: '#ff9900' },
  { id: 'work', name: 'Work', color: '#3366ff' }
]) {
  return writable({
    parsingSettings: {
      indicatorTag: 'TaskCard',
      markdownStartingNotation: '%%*',
      markdownEndingNotation: '*%%'
    },
    userMetadata: { projects }
  } as any);
}

describe('AttributeSuggester v2 value stage', () => {
  let suggester: AttributeSuggester;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-09T12:00:00'));
    suggester = new AttributeSuggester(makeStore() as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds the due value stage with a pinned parsed date row and canned shortcuts', () => {
    const line = '- [ ] Draft #TaskCard [due:: fri';
    const suggestions = suggester.buildSuggestions(line, line.length);

    expect(suggestions[0].kind).toBe('date-preview');
    expect(suggestions[0].accentText).toBe('→ Fri, Jul 10');
    expect(suggestions[0].replaceText).toBe('[due:: 2026-07-10] ');
    expect(suggestions.some((s) => s.displayText === 'today')).toBe(false);
  });

  it('shows canned due shortcuts for an empty value query', () => {
    const line = '- [ ] Draft #TaskCard [due:: ';
    const suggestions = suggester.buildSuggestions(line, line.length);

    expect(suggestions.map((s) => s.displayText)).toEqual([
      'today',
      'tomorrow',
      'next week'
    ]);
    expect(suggestions.map((s) => s.replaceText)).toEqual([
      '[due:: 2026-07-09] ',
      '[due:: 2026-07-10] ',
      '[due:: 2026-07-16] '
    ]);
  });

  it('offers canonical value suggestions for priority, project, repeat, and duration', () => {
    const priorityLine = '- [ ] Draft #TaskCard [priority:: p';
    expect(
      suggester
        .buildSuggestions(priorityLine, priorityLine.length)
        .map((s) => s.displayText)
    ).toEqual(['highest', 'high', 'medium', 'low']);

    const projectLine = '- [ ] Draft #TaskCard [project:: wo';
    const [projectSuggestion] = suggester.buildSuggestions(projectLine, projectLine.length);
    expect(projectSuggestion.displayText).toBe('Work');
    expect(projectSuggestion.color).toBe('#3366ff');
    expect(projectSuggestion.replaceText).toBe('[project:: Work] ');

    const repeatLine = '- [ ] Draft #TaskCard [repeat:: every we';
    expect(
      suggester
        .buildSuggestions(repeatLine, repeatLine.length)
        .map((s) => s.replaceText)
    ).toContain('[repeat:: every week] ');

    const durationLine = '- [ ] Draft #TaskCard [duration:: 1 hour';
    const durationSuggestions = suggester.buildSuggestions(durationLine, durationLine.length);
    expect(durationSuggestions.map((s) => s.replaceText)).toContain('[duration:: 1h] ');
  });

  it('supports sigil shortcuts and replaces them with canonical fields', () => {
    const dueLine = '- [ ] Draft #TaskCard @fri';
    const dueSuggestions = suggester.buildSuggestions(dueLine, dueLine.length);
    expect(dueSuggestions[0].replaceFrom).toBe(dueLine.lastIndexOf('@'));
    expect(dueSuggestions[0].replaceText).toBe('[due:: 2026-07-10] ');

    const projectLine = '- [ ] Draft #TaskCard +wo';
    const projectSuggestions = suggester.buildSuggestions(projectLine, projectLine.length);
    expect(projectSuggestions[0].replaceText).toBe('[project:: Work] ');
  });

  it('reopens value suggestions inside an existing field but not a code span', () => {
    const fieldLine = '- [ ] Draft #TaskCard [due:: tomorrow] ^tc-abc123';
    const cursor = fieldLine.lastIndexOf(']');
    const suggestions = suggester.buildSuggestions(fieldLine, cursor);
    expect(suggestions[0].kind).toBe('date-preview');
    expect(suggestions[0].replaceText).toBe('2026-07-10');
    expect(suggestions[0].replaceFrom).toBe(fieldLine.indexOf('tomorrow'));
    expect(suggestions[0].replaceTo).toBe(fieldLine.lastIndexOf(']'));

    const codeLine = '- [ ] Draft #TaskCard `@fri`';
    expect(suggester.buildSuggestions(codeLine, codeLine.indexOf('`@fri`') + 4)).toHaveLength(0);
  });

  it('suppresses the @ sigil when due is already set via the Tasks-emoji dialect', () => {
    const line = '- [ ] Buy groceries 📅 2026-07-12 #TaskCard @fri';
    expect(suggester.buildSuggestions(line, line.length)).toHaveLength(0);
  });

  it('treats a bare number duration query as minutes instead of milliseconds', () => {
    const line90 = '- [ ] Draft #TaskCard [duration:: 90';
    expect(
      suggester.buildSuggestions(line90, line90.length).map((s) => s.replaceText)
    ).toEqual(['[duration:: 90m] ']);

    const line2 = '- [ ] Draft #TaskCard [duration:: 2';
    expect(
      suggester.buildSuggestions(line2, line2.length).map((s) => s.replaceText)
    ).toEqual(['[duration:: 2h] ', '[duration:: 2m] ']);
  });

  it('never surfaces sub-minute fractional duration garbage in quick matches', () => {
    const line = '- [ ] Draft #TaskCard [3';
    const suggestions = suggester.buildSuggestions(line, line.length);
    const durationQuickMatches = suggestions.filter(
      (s) => s.kind === 'field' && s.key === 'duration'
    );

    // '30m' is a legitimate canned option that also starts with "3"; the bug
    // was fractional garbage like '0.00005m' from feeding "3" straight to
    // parse-duration (which treats bare numbers as milliseconds).
    expect(durationQuickMatches.every((s) => !/\.\d/.test(s.replaceText))).toBe(true);
    expect(durationQuickMatches.map((s) => s.replaceText)).toEqual([
      '[duration:: 30m] ',
      '[duration:: 3m] '
    ]);
  });
});
