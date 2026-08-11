import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  MarkdownView,
  TFile,
  setIcon
} from 'obsidian';
import { logger } from '../utils/log';
import { SettingStore } from '../settings';
import { SuggestInformation } from './index';
import { AttributeSuggester } from './Suggester';
import { TaskValidator } from '../taskModule/taskValidator';

export type SuggestInfoWithContext = SuggestInformation & {
  context: EditorSuggestContext;
};

export default class AttributeSuggest extends EditorSuggest<SuggestInformation> {
  // `app` comes from PopoverSuggest and is public there; redeclaring it
  // private narrows an inherited member's visibility, which TypeScript 5.4
  // rejects. super(app) already assigns it.
  private attributeSuggester: AttributeSuggester;
  private taskValidator: TaskValidator;

  constructor(app: App) {
    super(app);

    this.attributeSuggester = new AttributeSuggester(SettingStore);
    this.taskValidator = new TaskValidator(SettingStore);

    // @ts-ignore
    this.scope.register([], 'Tab', (evt: KeyboardEvent) => {
      // @ts-ignore
      this.suggestions.useSelectedItem(evt);
      return false;
    });
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile
  ): EditorSuggestTriggerInfo | null {
    const line = editor.getLine(cursor.line);
    if (!this.taskValidator.isTaskCardTaskMarkdown(line)) {
      return null;
    }
    if (!this.attributeSuggester.hasSuggestionTrigger(line, cursor.ch)) {
      return null;
    }
    return {
      start: { line: cursor.line, ch: 0 },
      end: { line: cursor.line, ch: line.length },
      query: line
    };
  }

  getSuggestions(context: EditorSuggestContext): SuggestInfoWithContext[] {
    const currentCursor = context.editor.getCursor();
    const suggestions = this.attributeSuggester.buildSuggestions(
      context.query,
      currentCursor.ch
    );
    return suggestions.map((suggestion) => ({ ...suggestion, context }));
  }

  renderSuggestion(suggestion: SuggestInfoWithContext, el: HTMLElement): void {
    el.empty();

    if (suggestion.sectionLabel) {
      el.createDiv({
        cls: 'taskcard-suggest-section',
        text: suggestion.sectionLabel
      });
    }

    // Presentation lives in styles.css under these classes; only the
    // per-project dot colour is set from code, and it goes through a custom
    // property rather than a direct style assignment.
    const row = el.createDiv({ cls: 'taskcard-suggest-row' });

    if (
      (suggestion.kind === 'date-preview' || suggestion.kind === 'value-preview') &&
      suggestion.accentText
    ) {
      row.createSpan({
        cls: 'taskcard-suggest-accent',
        text: suggestion.accentText
      });
      return;
    }

    const iconEl = row.createSpan({ cls: 'taskcard-suggest-icon' });
    if (suggestion.kind === 'field' && suggestion.key === 'project' && suggestion.color) {
      iconEl.addClass('taskcard-suggest-dot');
      iconEl.setCssProps({ '--taskcard-suggest-dot-color': suggestion.color });
    } else if (suggestion.icon) {
      setIcon(iconEl, suggestion.icon);
    }

    row.createSpan({
      cls: 'taskcard-suggest-main',
      text:
        suggestion.kind === 'field' && suggestion.sectionLabel
          ? `${suggestion.key}:: ${suggestion.displayText}`
          : suggestion.displayText
    });

    if (suggestion.hint) {
      row.createSpan({
        cls: 'taskcard-suggest-hint',
        text: suggestion.hint
      });
    }

    if (suggestion.rightText) {
      row.createSpan({
        cls: 'taskcard-suggest-right',
        text: suggestion.rightText
      });
    }
  }

  selectSuggestion(
    suggestion: SuggestInfoWithContext,
    _event: KeyboardEvent | MouseEvent
  ): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      logger.error('No active MarkdownView found.');
      return;
    }

    const currentCursor = suggestion.context.editor.getCursor();
    suggestion.context.editor.replaceRange(
      suggestion.replaceText,
      { line: currentCursor.line, ch: suggestion.replaceFrom },
      { line: currentCursor.line, ch: suggestion.replaceTo }
    );
    suggestion.context.editor.setCursor({
      line: currentCursor.line,
      ch: suggestion.cursorPosition
    });
  }
}
