/** @jest-environment jsdom */

import { App, EditorSuggest, MarkdownView, WorkspaceLeaf } from 'obsidian';
import AttributeSuggest from '../src/autoSuggestions/EditorSuggestions';
import { DefaultSettings, SettingStore } from '../src/settings';

const scopeRegister = jest.fn();
(EditorSuggest.prototype as any).scope = { register: scopeRegister };

function freshSettings() {
  const settings = JSON.parse(JSON.stringify(DefaultSettings));
  settings.userMetadata.projects = [
    { id: 'bookclub', name: 'BookClub', color: '#ff9900' },
    { id: 'work', name: 'Work', color: '#3366ff' }
  ];
  return settings;
}

function makeEditor(
  lines: string[],
  cursor: { line: number; ch: number } = { line: 0, ch: 0 }
) {
  return {
    getLine: jest.fn((line: number) => lines[line] ?? ''),
    getCursor: jest.fn(() => cursor),
    replaceRange: jest.fn(),
    setCursor: jest.fn()
  };
}

function makeSuggest() {
  const app = new App();
  const leaf: any = new (WorkspaceLeaf as any)();
  leaf.view = new (MarkdownView as any)();
  (app.workspace as any).activeLeaf = leaf;
  return { app, suggest: new AttributeSuggest(app as any) };
}

describe('AttributeSuggest editor integration', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-09T12:00:00'));
    SettingStore.set(freshSettings());
    scopeRegister.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers the Tab handler', () => {
    makeSuggest();
    expect(scopeRegister).toHaveBeenCalledWith([], 'Tab', expect.any(Function));
  });

  it('triggers only for supported TaskCard contexts', () => {
    const { suggest } = makeSuggest();

    const bracketLine = '- [ ] Draft #TaskCard [';
    expect(
      suggest.onTrigger(
        { line: 0, ch: bracketLine.length } as any,
        makeEditor([bracketLine]) as any,
        null as any
      )
    ).toEqual({
      start: { line: 0, ch: 0 },
      end: { line: 0, ch: bracketLine.length },
      query: bracketLine
    });

    const sigilLine = '- [ ] Draft #TaskCard @fri';
    expect(
      suggest.onTrigger(
        { line: 0, ch: sigilLine.length } as any,
        makeEditor([sigilLine]) as any,
        null as any
      )
    ).not.toBeNull();

    expect(
      suggest.onTrigger(
        { line: 0, ch: 6 } as any,
        makeEditor(['- [ ] Draft #TaskCard']) as any,
        null as any
      )
    ).toBeNull();

    expect(
      suggest.onTrigger(
        { line: 0, ch: 4 } as any,
        makeEditor(['- [ ] Draft [']) as any,
        null as any
      )
    ).toBeNull();
  });

  it('maps suggestions using the live cursor position', () => {
    const { suggest } = makeSuggest();
    const line = '- [ ] Draft #TaskCard [du';
    const editor = makeEditor([line], { line: 0, ch: line.length });

    const suggestions = suggest.getSuggestions({ editor, query: line } as any);

    expect(suggestions.map((s) => s.displayText)).toEqual([
      'due',
      'scheduled',
      'duration'
    ]);
    expect(suggestions.every((s) => s.context.editor === (editor as any))).toBe(true);
  });

  it('renders section labels, icon rows, and right-aligned sigils without innerHTML', () => {
    const { suggest } = makeSuggest();
    const line = '- [ ] Draft #TaskCard [fri';
    const editor = makeEditor([line], { line: 0, ch: line.length });
    const suggestions = suggest.getSuggestions({ editor, query: line } as any);
    const quickMatch = suggestions.find((s) => s.sectionLabel === 'quick matches');
    expect(quickMatch).toBeDefined();

    const el = document.createElement('div');
    suggest.renderSuggestion(quickMatch as any, el);

    expect(el.querySelector('.taskcard-suggest-section')?.textContent).toBe('quick matches');
    expect(el.textContent).toContain('due:: Fri, Jul 10');

    const keyEl = document.createElement('div');
    suggest.renderSuggestion(
      {
        ...(suggestions.find((s) => s.kind === 'key') as any)
      },
      keyEl
    );
    expect(keyEl.textContent).toContain('@');
  });

  it('selects suggestions with canonical replacement strings and cursor placement', () => {
    const { suggest } = makeSuggest();

    const bracketLine = '- [ ] Draft #TaskCard [du';
    const bracketEditor = makeEditor([bracketLine], { line: 2, ch: bracketLine.length });
    const [keySuggestion] = suggest.getSuggestions({
      editor: bracketEditor,
      query: bracketLine
    } as any);

    suggest.selectSuggestion(keySuggestion as any, {} as any);
    expect(bracketEditor.replaceRange).toHaveBeenCalledWith(
      '[due:: ]',
      { line: 2, ch: bracketLine.lastIndexOf('[') },
      { line: 2, ch: bracketLine.length }
    );
    expect(bracketEditor.setCursor).toHaveBeenCalledWith({
      line: 2,
      ch: bracketLine.lastIndexOf('[') + '[due:: ]'.length - 1
    });

    const sigilLine = '- [ ] Draft #TaskCard @fri';
    const sigilEditor = makeEditor([sigilLine], { line: 0, ch: sigilLine.length });
    const [sigilSuggestion] = suggest.getSuggestions({
      editor: sigilEditor,
      query: sigilLine
    } as any);

    suggest.selectSuggestion(sigilSuggestion as any, {} as any);
    expect(sigilEditor.replaceRange).toHaveBeenCalledWith(
      '[due:: 2026-07-10] ',
      { line: 0, ch: sigilLine.lastIndexOf('@') },
      { line: 0, ch: sigilLine.length }
    );
    expect(sigilEditor.setCursor).toHaveBeenCalledWith({
      line: 0,
      ch: sigilLine.lastIndexOf('@') + '[due:: 2026-07-10] '.length
    });
  });

  it('replaces only the value when choosing inside an existing closed field', () => {
    const { suggest } = makeSuggest();
    const line = '- [ ] Draft #TaskCard [due:: tomorrow] ^tc-abc123';
    const cursor = { line: 0, ch: line.lastIndexOf(']') };
    const editor = makeEditor([line], cursor);

    expect(suggest.onTrigger(cursor as any, editor as any, null as any)).not.toBeNull();
    const [suggestion] = suggest.getSuggestions({ editor, query: line } as any);
    suggest.selectSuggestion(suggestion as any, {} as any);

    expect(editor.replaceRange).toHaveBeenCalledWith(
      '2026-07-10',
      { line: 0, ch: line.indexOf('tomorrow') },
      { line: 0, ch: line.lastIndexOf(']') }
    );
    expect(editor.setCursor).toHaveBeenCalledWith({
      line: 0,
      ch: line.indexOf('tomorrow') + '2026-07-10'.length
    });
  });
});
