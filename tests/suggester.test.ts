import { writable } from 'svelte/store';
import { AttributeSuggester } from '../src/autoSuggestions/Suggester';

function makeStore(projects: any = [
  { id: 'home', name: 'Home', color: '#22aa66' },
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

describe('AttributeSuggester v2 key stage', () => {
  let suggester: AttributeSuggester;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-09T12:00:00'));
    suggester = new AttributeSuggester(makeStore() as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the full key list for an empty open bracket query', () => {
    const line = '- [ ] Draft launch post #TaskCard [';
    const suggestions = suggester.buildSuggestions(line, line.length);

    expect(suggestions.map((s) => s.displayText)).toEqual([
      'due',
      'scheduled',
      'priority',
      'project',
      'repeat',
      'duration'
    ]);
    expect(suggestions.every((s) => s.kind === 'key')).toBe(true);
    expect(suggestions[0].replaceText).toBe('[due:: ]');
    expect(suggestions[0].cursorPosition).toBe(line.lastIndexOf('[') + '[due:: ]'.length - 1);
  });

  it('filters keys and excludes fields already present on the line', () => {
    const line = '- [ ] Draft #TaskCard [due:: 2026-07-10] [pr';
    const suggestions = suggester.buildSuggestions(line, line.length);

    expect(suggestions.map((s) => s.displayText)).toEqual(['priority', 'project']);
  });

  it('never opens on non-task lines or task lines without the indicator tag', () => {
    expect(
      suggester.buildSuggestions('just a note [', 'just a note ['.length)
    ).toHaveLength(0);
    expect(
      suggester.buildSuggestions('- [ ] plain task [', '- [ ] plain task ['.length)
    ).toHaveLength(0);
  });

  it('generates quick matches for dates, priority, project, repeat, and duration', () => {
    const dateLine = '- [ ] Draft #TaskCard [fri';
    const dateSuggestions = suggester.buildSuggestions(dateLine, dateLine.length);
    expect(dateSuggestions.some((s) => s.sectionLabel === 'quick matches')).toBe(true);
    expect(dateSuggestions.some((s) => s.replaceText === '[due:: 2026-07-10] ')).toBe(true);
    expect(
      dateSuggestions.some((s) => s.replaceText === '[scheduled:: 2026-07-10] ')
    ).toBe(true);

    const priorityLine = '- [ ] Draft #TaskCard [p1';
    expect(
      suggester
        .buildSuggestions(priorityLine, priorityLine.length)
        .some((s) => s.replaceText === '[priority:: highest] ')
    ).toBe(true);

    const projectLine = '- [ ] Draft #TaskCard [wo';
    expect(
      suggester
        .buildSuggestions(projectLine, projectLine.length)
        .some((s) => s.replaceText === '[project:: Work] ')
    ).toBe(true);

    const repeatLine = '- [ ] Draft #TaskCard [every w';
    expect(
      suggester
        .buildSuggestions(repeatLine, repeatLine.length)
        .some((s) => s.replaceText === '[repeat:: every week] ')
    ).toBe(true);

    const durationLine = '- [ ] Draft #TaskCard [1h';
    expect(
      suggester
        .buildSuggestions(durationLine, durationLine.length)
        .some((s) => s.replaceText === '[duration:: 1h] ')
    ).toBe(true);
  });

  it('does not trigger the key popup inside a wikilink', () => {
    const line = '- [ ] Review [[Project Plan #TaskCard';
    const cursorPos = line.indexOf('Project Plan') + 'Project Plan'.length;

    expect(suggester.hasSuggestionTrigger(line, cursorPos)).toBe(false);
    expect(suggester.buildSuggestions(line, cursorPos)).toHaveLength(0);
  });

  it('excludes keys already present via the Tasks-emoji dialect from the key list', () => {
    const line = '- [ ] Buy groceries 📅 2026-07-12 #TaskCard [';
    const suggestions = suggester.buildSuggestions(line, line.length);

    expect(suggestions.map((s) => s.displayText)).not.toContain('due');
    expect(suggestions.map((s) => s.displayText)).toEqual([
      'scheduled',
      'priority',
      'project',
      'repeat',
      'duration'
    ]);
  });

  it('restricts to an exact prefix match once the query fully spells a key name, but keeps genuine ambiguity for shorter queries', () => {
    const dueLine = '- [ ] Draft #TaskCard [due';
    expect(
      suggester.buildSuggestions(dueLine, dueLine.length).map((s) => s.displayText)
    ).toEqual(['due']);

    const proLine = '- [ ] Draft #TaskCard [pro';
    expect(
      suggester.buildSuggestions(proLine, proLine.length).map((s) => s.displayText)
    ).toEqual(['priority', 'project']);
  });
});
