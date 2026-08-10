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
  private app: App;
  private attributeSuggester: AttributeSuggester;
  private taskValidator: TaskValidator;

  constructor(app: App) {
    super(app);
    this.app = app;

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

    const row = el.createDiv({ cls: 'taskcard-suggest-row' });
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '0.5rem';

    if (
      (suggestion.kind === 'date-preview' || suggestion.kind === 'value-preview') &&
      suggestion.accentText
    ) {
      const accent = row.createSpan({
        cls: 'taskcard-suggest-accent',
        text: suggestion.accentText
      });
      accent.style.color = 'var(--text-accent)';
      accent.style.fontWeight = '600';
      return;
    }

    const iconEl = row.createSpan({ cls: 'taskcard-suggest-icon' });
    if (suggestion.kind === 'field' && suggestion.key === 'project' && suggestion.color) {
      iconEl.style.width = '0.5rem';
      iconEl.style.height = '0.5rem';
      iconEl.style.borderRadius = '999px';
      iconEl.style.backgroundColor = suggestion.color;
      iconEl.style.display = 'inline-block';
      iconEl.style.flexShrink = '0';
    } else if (suggestion.icon) {
      setIcon(iconEl, suggestion.icon);
      iconEl.style.color = 'var(--text-faint)';
      iconEl.style.flexShrink = '0';
    }

    const mainText = row.createSpan({
      cls: 'taskcard-suggest-main',
      text:
        suggestion.kind === 'field' && suggestion.sectionLabel
          ? `${suggestion.key}:: ${suggestion.displayText}`
          : suggestion.displayText
    });
    mainText.style.color = 'var(--text-normal)';

    if (suggestion.hint) {
      const hint = row.createSpan({
        cls: 'taskcard-suggest-hint',
        text: suggestion.hint
      });
      hint.style.color = 'var(--text-faint)';
      hint.style.whiteSpace = 'nowrap';
    }

    if (suggestion.rightText) {
      const right = row.createSpan({
        cls: 'taskcard-suggest-right',
        text: suggestion.rightText
      });
      right.style.marginLeft = 'auto';
      right.style.color = 'var(--text-faint)';
      right.style.whiteSpace = 'nowrap';
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
