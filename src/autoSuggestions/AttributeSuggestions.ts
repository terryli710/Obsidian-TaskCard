


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
import { logger } from "../log";

interface IAttributeSuggestion {
    label: string;
}

export default class AttributeSuggest extends EditorSuggest<IAttributeSuggestion> {
    private app: App;
    private readonly STARTING_NOTATION = "%%*";
    private readonly ENDING_NOTATION = "*%%";

    constructor(app: App) {
        super(app);
        this.app = app;
    
        // Register an event for the Tab key
        // @ts-ignore
        this.scope.register([], "Tab", (evt: KeyboardEvent) => {
            // @ts-ignore
            this.suggestions.useSelectedItem(evt);
            return false;  // Prevent the default behavior of the Tab key (like indentation)
        });

    }
    

    getSuggestions(context: EditorSuggestContext): IAttributeSuggestion[] {
        const attributes = [
            "priority",
            "description",
            "project",
            "labels",
            "due",
            "metadata"
        ];
    
        // Convert the query to lowercase for case-insensitive comparison
        const queryLower = context.query.toLowerCase();
    
        // Filter the attributes based on the query and return the matching attributes
        return attributes
            .filter(attr => attr.toLowerCase().startsWith(queryLower))
            .map(attr => ({ label: attr }));
    }

    renderSuggestion(suggestion: IAttributeSuggestion, el: HTMLElement): void {
        el.setText(suggestion.label);
    }

    selectSuggestion(suggestion: IAttributeSuggestion, event: KeyboardEvent | MouseEvent): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            logger.error("No active MarkdownView found.");
            return;
        }
    
        const insertText = `${this.STARTING_NOTATION}${suggestion.label}: ${this.ENDING_NOTATION}`;
        const adjustedEnd = this.getAdjustedEndPosition(activeView.editor, this.context.end);
    
        activeView.editor.replaceRange(insertText, this.context.start, adjustedEnd);
        const cursorPosition = { 
            line: this.context.start.line, 
            ch: this.context.start.ch + insertText.length - this.ENDING_NOTATION.length 
        };
        activeView.editor.setCursor(cursorPosition);
        // this.close();
    }
    

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo {
        // TODO: return null if the plugin is not loaded
        const startPos = this.context?.start || {
            line: cursor.line,
            ch: cursor.ch - this.STARTING_NOTATION.length,
        };

        const potentialTrigger = editor.getRange(startPos, cursor);

        if (!potentialTrigger.startsWith(this.STARTING_NOTATION)) {
            return null;
        }
    
        return {
            start: startPos,
            end: cursor,
            query: editor.getRange(startPos, cursor).substring(this.STARTING_NOTATION.length),
        };
    }

    private getAdjustedEndPosition(editor: Editor, end: EditorPosition): EditorPosition {
        // if the cursor is the last character of the line, return the end position
        if (end.ch === editor.getLine(end.line).length) { return end; }

        // Check if the text after the cursor matches the beginning of ENDING_NOTATION
        for (let i = 1; i <= this.ENDING_NOTATION.length; i++) {
            const checkEndPos = { line: end.line, ch: end.ch + i };
            const textAfterCursor = editor.getRange(end, checkEndPos);
            
            if (this.ENDING_NOTATION.startsWith(textAfterCursor)) {
                // Check if it's followed by a space or end of line
                const afterCheckEndPosChar = editor.getRange(checkEndPos, { line: checkEndPos.line, ch: checkEndPos.ch + 1 });
                if (afterCheckEndPosChar === ' ' || afterCheckEndPosChar === '\n' || afterCheckEndPosChar === '') {
                    return checkEndPos; // Adjust the end position to include the matching part of ENDING_NOTATION
                }
            }
        }
        return end; // Return the original end if no matches were found
    }
    
    
}