


import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    MarkdownView,
    TFile,
  } from "obsidian";
import { logger } from "../utils/log";
import { SettingStore } from "../settings";
import { SuggestInformation } from './index';
import { AttributeSuggester } from "./Suggester";
import { TaskValidator } from "../taskModule/taskValidator";

export type SuggestInfoWithContext = SuggestInformation & {
    context: EditorSuggestContext;
}

export default class AttributeSuggest extends EditorSuggest<SuggestInformation> {
    private app: App;
    private attributeSuggester: AttributeSuggester;
    private taskValidator: TaskValidator;

    constructor(app: App) {
        super(app);
        this.app = app;

        this.attributeSuggester = new AttributeSuggester(SettingStore);
        this.taskValidator = new TaskValidator(SettingStore);
    
        // Register an event for the Tab key
        // @ts-ignore
        this.scope.register([], "Tab", (evt: KeyboardEvent) => {
            // @ts-ignore
            this.suggestions.useSelectedItem(evt);
            return false;  // Prevent the default behavior of the Tab key (like indentation)
        });

    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo {
        // TODO: return null if the plugin is not loaded
        const line = editor.getLine(cursor.line);
        if (!this.taskValidator.isValidUnformattedTaskMarkdown(line)) {return null;}
        return {
            start: { line: cursor.line, ch: 0 },
            end: {
                line: cursor.line,
                ch: line.length,
            },
            query: line,
        };
    }
    
    getSuggestions(context: EditorSuggestContext): SuggestInfoWithContext[] {
        const line = context.query;
        const currentCursor = context.editor.getCursor();
        const cursorPos = currentCursor.ch;

        const suggestions: SuggestInformation[] = this.attributeSuggester.buildSuggestions(line, cursorPos);
        return suggestions.map((s) => ({ ...s, context }));
    }

    renderSuggestion(suggestion: SuggestInfoWithContext, el: HTMLElement): void {
        el.setText(suggestion.displayText);
    }

    selectSuggestion(suggestion: SuggestInfoWithContext, event: KeyboardEvent | MouseEvent): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            logger.error("No active MarkdownView found.");
            return;
        }
        const currentCursor = suggestion.context.editor.getCursor();
        const replaceFrom = {
            line: currentCursor.line,
            ch: suggestion.replaceFrom ?? currentCursor.ch,
        };
        const replaceTo = {
            line: currentCursor.line,
            ch: suggestion.replaceTo ?? currentCursor.ch,
        }
        suggestion.context.editor.replaceRange(suggestion.replaceText, replaceFrom, replaceTo);
        suggestion.context.editor.setCursor(
            {
                line: currentCursor.line,
                ch: suggestion.cursorPosition
            }
        );
    }
    
    
}