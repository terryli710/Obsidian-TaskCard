import { get } from "svelte/store";
import { SettingStore } from "../settings";
import { EditorSuggestContext } from "obsidian";
import { SuggestInformation } from ".";
import { ObsidianTask } from "../taskModule/task";
import { escapeRegExp } from "../utils/regexUtils";


export class AttributeSuggester {
    private startingNotation: string;
    private endingNotation: string;

    constructor(settingsStore: typeof SettingStore) {
        // Subscribe to the settings store
        settingsStore.subscribe(settings => {
            this.startingNotation = escapeRegExp(settings.parsingSettings.startingNotation);
            this.endingNotation = escapeRegExp(settings.parsingSettings.endingNotation);
        });
    }

    buildSuggestions(lineText: string, cursorPos: number): SuggestInformation[] {
        let suggestions: SuggestInformation[] = [];
        // add the attributes
        suggestions.concat(this.getAttributeSuggestions(lineText, cursorPos));
        // add the priority
        suggestions.concat(this.getPrioritySuggestions(lineText, cursorPos));
        // add the due
        suggestions.concat(this.getDueSuggestions(lineText, cursorPos));
        return suggestions;
    }

    getAttributeSuggestions(lineText: string, cursorPos: number): SuggestInformation[] {
        let suggestions: SuggestInformation[] = [];

        const attributeRegex = new RegExp(`${this.startingNotation}\s?`, 'g');
        const attributeMatch = matchByPosition(lineText, attributeRegex, cursorPos);
        if (!attributeMatch) return suggestions; // No match
        const nonInputtableAttributes: string[] = ['id', 'children', 'parent', 'order', 'sectionID', 'completed']; // Add more attributes as needed

        // Filter out the non-inputtable attributes
        const inputtableAttributes = Object.keys(new ObsidianTask()).filter(attr => !nonInputtableAttributes.includes(attr));

        const adjustedEndPosition = adjustEndPosition(lineText.substring(cursorPos), this.endingNotation);
        suggestions = inputtableAttributes.map(attr => {
            return {
                displayText: attr,
                replaceText: `${this.startingNotation}${attr}: ${this.endingNotation}`,
                replaceFrom: attributeMatch.index,
                replaceTo: cursorPos + adjustedEndPosition,
                cursorPosition: cursorPos + this.startingNotation.length + attr.length + 2
            }
        })

        return suggestions;
    }

    getPrioritySuggestions(lineText: string, cursorPos: number): SuggestInformation[] {
        let suggestions: SuggestInformation[] = [];

        const priorityRegex = new RegExp(`${this.startingNotation}\s?priority:\s?`, 'g');
        const priorityMatch = matchByPosition(lineText, priorityRegex, cursorPos);
        if (!priorityMatch) return suggestions; // No match
        const prioritySelections = ['1', '2', '3', '4'];
        suggestions = prioritySelections.map(priority => {
            return {
                displayText: priority,
                replaceText: `${this.startingNotation}priority: ${priority}`,
                replaceFrom: priorityMatch.index,
                replaceTo: cursorPos,
                cursorPosition: cursorPos + priority.length + this.endingNotation.length
            }
        })


        return suggestions;
    }

    getDueSuggestions(lineText: string, cursorPos: number): SuggestInformation[] {
        let suggestions: SuggestInformation[] = [];

        const dueRegex = new RegExp(`${this.startingNotation}\s?due:\s?`, 'g');
        const dueMatch = matchByPosition(lineText, dueRegex, cursorPos);
        if (!dueMatch) return suggestions; // No match
        const dueStringSelections = [
            'today',
            'tomorrow',
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'next week',
            'next month',
            'next year',
        ];
        suggestions = dueStringSelections.map(dueString => {
            return {
                displayText: dueString,
                replaceText: `${this.startingNotation}due: ${dueString}`,
                replaceFrom: dueMatch.index,
                replaceTo: cursorPos,
                cursorPosition: cursorPos + dueString.length + this.endingNotation.length
            }
        })
    }

}


/**
 * Matches a string with a regex according to a position (typically of a cursor).
 * Will return a result only if a match exists and the given position is part of it.
 */
export function matchByPosition(s: string, r: RegExp, position: number): RegExpMatchArray | void {
    const matches = s.matchAll(r);
    for (const match of matches) {
        if (match?.index && match.index <= position && position <= match.index + match[0].length) return match;
    }
}

export function adjustEndPosition(remainLineText: string, endingNotation: string): number {
    if (!remainLineText) return 0;

    for (let i = 1; i <= endingNotation.length; i++) {
        const textAfterCursor = remainLineText.substring(remainLineText.length - i);
        
        if (endingNotation.startsWith(textAfterCursor)) {
            // Check if it's followed by a space or end of line
            const afterCheckEndPosChar = remainLineText.substring(remainLineText.length - i + 1);
            if (afterCheckEndPosChar === ' ' || afterCheckEndPosChar === '\n' || afterCheckEndPosChar === '') {
                return i
            }
        }
    }
    return 0;
}