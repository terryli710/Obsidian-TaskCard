

import { writable } from 'svelte/store';
import { AttributeSuggester, matchByPosition, adjustEndPosition } from '../src/autoSuggestions/Suggester'; // Update the path


describe('AttributeSuggester', () => {
    let suggester;
    let mockSettingStore;

    beforeEach(() => {
        // Mock the SettingStore with controlled settings
        mockSettingStore = writable({
            parsingSettings: {
                indicatorTag: 'TaskCard',
                startingNotation: '%%*',
                endingNotation: '*%%'
            }
        });
        suggester = new AttributeSuggester(mockSettingStore);
    });

    it('initializes startingNotation and endingNotation from settingsStore', () => {
        expect(suggester.startingNotation).toBe("{{");
        expect(suggester.endingNotation).toBe("}}");
    });

    it('builds suggestions correctly', () => {
        const lineText = "{{ attribute }}";
        const cursorPos = 5;
        const suggestions = suggester.buildSuggestions(lineText, cursorPos);
        expect(suggestions).toHaveLength(3); // Assuming 3 suggestions are returned
    });

    it('gets attribute suggestions', () => {
        const lineText = "{{ attribute }}";
        const cursorPos = 5;
        const suggestions = suggester.getAttributeSuggestions(lineText, cursorPos);
        expect(suggestions).toHaveLength(1); // Assuming 1 attribute suggestion is returned
    });

    it('gets priority suggestions', () => {
        const lineText = "{{ priority: }}";
        const cursorPos = 12;
        const suggestions = suggester.getPrioritySuggestions(lineText, cursorPos);
        expect(suggestions).toHaveLength(4); // Assuming 4 priority suggestions are returned
    });

    it('gets due suggestions', () => {
        const lineText = "{{ due: }}";
        const cursorPos = 8;
        const suggestions = suggester.getDueSuggestions(lineText, cursorPos);
        expect(suggestions).toHaveLength(12); // Assuming 12 due suggestions are returned
    });
});

describe('Utility functions', () => {
    it('matches by position', () => {
        const s = "Hello {{ world }}!";
        const r = /{{\s?/;
        const position = 8;
        const match = matchByPosition(s, r, position);
        expect(match[0]).toBe("{{ ");
    });

    it('adjusts end position', () => {
        const remainLineText = " world }}!";
        const endingNotation = "}}";
        const adjustment = adjustEndPosition(remainLineText, endingNotation);
        expect(adjustment).toBe(2);
    });
});

// Add more tests and edge cases as needed
