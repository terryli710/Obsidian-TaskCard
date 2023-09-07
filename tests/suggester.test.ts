import { writable } from 'svelte/store';
import {
  AttributeSuggester,
  matchByPosition,
  adjustEndPosition,
  matchByPositionAndGroup
} from '../src/autoSuggestions/Suggester'; // Update the path
import { logger } from '../src/utils/log';

describe('AttributeSuggester', () => {
  let suggester: AttributeSuggester;
  let mockSettingStore;

  beforeEach(() => {
    // Mock the SettingStore with controlled settings
    mockSettingStore = writable({
      parsingSettings: {
        indicatorTag: 'TaskCard',
        markdownStartingNotation: '{{',
        markdownEndingNotation: '}}'
      },
      userMetadata: {
        projects: [
          { id: 1, name: 'Project 1', color: '#000000' },
          { id: 2, name: 'Project 2', color: '#000000' }
        ]
      }
    });
    suggester = new AttributeSuggester(mockSettingStore);
  });

  // it('initializes startingNotation and endingNotation from settingsStore', () => {
  //   expect(suggester.startingNotation).toBe('{{');
  //   expect(suggester.endingNotation).toBe('}}');
  // });

  it('builds suggestions correctly', () => {
    const lineText = '{{ ';
    const cursorPos = 2;
    const suggestions = suggester.buildSuggestions(lineText, cursorPos);
    expect(suggestions).toHaveLength(3); // Assuming 3 attribute suggestions are returned
  });

  it('gets attribute suggestions', () => {
    const lineText = '{{ ';
    const cursorPos = 2;
    const suggestions = suggester.getAttributeSuggestions(lineText, cursorPos);
    expect(suggestions).toHaveLength(3); // Assuming 3 attribute suggestion is returned
  });

  it('gets priority suggestions', () => {
    const lineText = '{{ priority: }}';
    const cursorPos = 13;
    const suggestions = suggester.getPrioritySuggestions(lineText, cursorPos);
    expect(suggestions).toHaveLength(4); // Assuming 4 priority suggestions are returned
  });

  it('gets due suggestions', () => {
    const lineText = '{{ due: t }}';
    const cursorPos = 9;
    const suggestions = suggester.getDueSuggestions(lineText, cursorPos);
    expect(suggestions).toHaveLength(4); // Assuming 4 due suggestions are returned
  });

  it('wont get attribute suggestions if the endingNotation is not found', () => {
    const lineText = '{{ priority: ';
    const cursorPos = 13;
    const suggestions = suggester.getAttributeSuggestions(lineText, cursorPos);
    expect(suggestions).toHaveLength(0);
  });

  it('wont get priority suggestions if cursor is not at the correct position', () => {
    const lineText = '{{ due: ';
    const cursorPos = 6;
    const suggestions = suggester.getDueSuggestions(lineText, cursorPos);
    expect(suggestions).toHaveLength(0);
  });

  it('will replace the right amount of text', () => {
    const lineText = 'abc {{ priority: }}';
    const cursorPos = 17;
    const suggestions = suggester.getPrioritySuggestions(lineText, cursorPos);
    expect(suggestions[0].replaceFrom).toBe(4);
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
    expect(result[0]).toBe('{{ ');
  });
});

describe('matchByPositionAndGroup', () => {
  it('should return the match if position is within the desired group', () => {
    const s = 'hello world this is test';
    const r = /world (this) is/g;
    const position = 14; // Within "this"
    const groupIndex = 1;
    const result = matchByPositionAndGroup(s, r, position, groupIndex);
    expect(result && result[groupIndex]).toBe('this');
  });

  it('should return void if position is outside the desired group', () => {
    const s = 'hello world this is test';
    const r = /world (this) is/g;
    const position = 10; // Outside "this"
    const groupIndex = 1;
    const result = matchByPositionAndGroup(s, r, position, groupIndex);
    expect(result).toBeUndefined();
  });

  it('should handle multiple matches and return the correct group based on position', () => {
    const s = 'apple red apple green apple blue';
    const r = /apple (red|green|blue)/g;
    const position = 30; // Within "blue"
    const groupIndex = 1;
    const result = matchByPositionAndGroup(s, r, position, groupIndex);
    expect(result && result[groupIndex]).toBe('blue');
  });

  it('should return void if no matches are found', () => {
    const s = 'hello world this is test';
    const r = /sample (text) here/g;
    const position = 15;
    const groupIndex = 1;
    const result = matchByPositionAndGroup(s, r, position, groupIndex);
    expect(result).toBeUndefined();
  });

  it('another case that mimics the startingNotation', () => {
    const s = '{{ project: test }}';
    const r = /\{\{\s?project:\s?([a-zA-Z]*)\s?\}\}/g;
    const position = 14; // Within "test"
    const groupIndex = 1;
    const result = matchByPositionAndGroup(s, r, position, groupIndex);
    expect(result && result[groupIndex]).toBe('test');
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
