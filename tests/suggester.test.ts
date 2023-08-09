

import { writable } from 'svelte/store';
import { AttributeSuggester, matchByPosition, adjustEndPosition } from '../src/autoSuggestions/Suggester'; // Update the path
import { logger } from '../src/log';


describe('AttributeSuggester', () => {
    let suggester;
    let mockSettingStore;

    beforeEach(() => {
        // Mock the SettingStore with controlled settings
        mockSettingStore = writable({
            parsingSettings: {
                indicatorTag: 'TaskCard',
                startingNotation: '{{',
                endingNotation: '}}'
            }
        });
        suggester = new AttributeSuggester(mockSettingStore);
    });

    it('initializes startingNotation and endingNotation from settingsStore', () => {
        expect(suggester.startingNotation).toBe("\\{\\{");
        expect(suggester.endingNotation).toBe("\\}\\}");
    });

    it('builds suggestions correctly', () => {
        const lineText = "{{ ";
        const cursorPos = 2;
        const suggestions = suggester.buildSuggestions(lineText, cursorPos);
        logger.debug(`suggestions: ${suggestions}`);
        expect(suggestions).toHaveLength(7); // Assuming 7 attribute suggestions are returned
    });

    it('gets attribute suggestions', () => {
        const lineText = "{{ ";
        const cursorPos = 2;
        const suggestions = suggester.getAttributeSuggestions(lineText, cursorPos);
        expect(suggestions).toHaveLength(7); // Assuming 1 attribute suggestion is returned
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

describe('matchByPosition', () => {
    it('should return the match if position is within the match', () => {
        const s = 'hello world';
        const r = /world/g;
        const position = 8;
        const result = matchByPosition(s, r, position);
        expect(result[0]).toBe('world');
    });

    it('should return void if position is outside any match', () => {
        const s = 'hello world';
        const r = /world/g;
        const position = 4;
        const result = matchByPosition(s, r, position);
        expect(result).toBeUndefined();
    });

    it('should handle multiple matches and return the correct one based on position', () => {
        const s = 'apple apple apple';
        const r = /apple/g;
        const position = 12;
        const result = matchByPosition(s, r, position);
        expect(result[0]).toBe('apple');
    });

    it('should return void if no matches are found', () => {
        const s = 'hello world';
        const r = /test/g;
        const position = 5;
        const result = matchByPosition(s, r, position);
        expect(result).toBeUndefined();
    });

    it('another case that mimic the startingNotation', () => {
        const s = '{{ ';
        const r = /\{\{\s?/g;
        const position = 1;
        const result = matchByPosition(s, r, position);
        logger.debug(`result: ${JSON.stringify(result)}`);
        expect(result[0]).toBe('{{ ');
    });
});

describe('adjustEndPosition', () => {
    it('should return 0 for empty remainLineText', () => {
        const result = adjustEndPosition('', '}}');
        expect(result).toBe(0);
    });

    it('should return correct position when endingNotation matches at the end', () => {
        const result = adjustEndPosition('}}', '}}');
        expect(result).toBe(2);
    });

    it('should return correct position when endingNotation partially matches at the end', () => {
        const result = adjustEndPosition('}', '}}');
        expect(result).toBe(1);
    });

    it('should return 0 when endingNotation does not match at the end', () => {
        const result = adjustEndPosition('Hello World', '}}');
        expect(result).toBe(0);
    });

    it('should return correct position when matched notation is followed by a space', () => {
        const result = adjustEndPosition('} ', '}}');
        expect(result).toBe(1);
    });

    it('should return correct position when matched notation is followed by a newline', () => {
        const result = adjustEndPosition('}\n', '}}');
        expect(result).toBe(1);
    });

    it('should return 0 when matched notation is followed by a non-space character', () => {
        const result = adjustEndPosition('}a', '}}');
        expect(result).toBe(0);
    });
});
