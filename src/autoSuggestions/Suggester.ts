import { SettingStore } from '../settings';
import { SuggestInformation } from '.';
import { ObsidianTask } from '../taskModule/task';
import { escapeRegExp, getGroupStartIndex } from '../utils/regexUtils';
import { logger } from '../utils/log';
import { Project } from '../taskModule/project';
import { filterTaskItems } from '../renderer/filters';

export class AttributeSuggester {
  private startingNotation: string;
  private endingNotation: string;
  private projects: Project[];
  private nonInputtableAttributes: string[];
  private inputtableAttributes: string[];

  constructor(settingsStore: typeof SettingStore) {
    // Subscribe to the settings store
    settingsStore.subscribe((settings) => {
      this.startingNotation = settings.parsingSettings.markdownStartingNotation;
      this.endingNotation = settings.parsingSettings.markdownEndingNotation;
      this.projects = settings.userMetadata.projects;
      this.nonInputtableAttributes = [
        'id',
        'content',
        'children',
        'parent',
        'order',
        'sectionID',
        'completed',
        'labels'
      ];
  
      // Filter out the non-inputtable attributes
      this.inputtableAttributes = Object.keys(new ObsidianTask()).filter(
        (attr) => !this.nonInputtableAttributes.includes(attr)
      );
    });
  }

  buildSuggestions(lineText: string, cursorPos: number): SuggestInformation[] {
    let suggestions: SuggestInformation[] = [];
    suggestions = suggestions.concat(
      this.getAttributeSuggestions(lineText, cursorPos)
    );
    suggestions = suggestions.concat(
      this.getPrioritySuggestions(lineText, cursorPos)
    );
    suggestions = suggestions.concat(
      this.getDueSuggestions(lineText, cursorPos)
    );
    suggestions = suggestions.concat(
      this.getProjectSuggestions(lineText, cursorPos)
    );
    return suggestions;
  }

  getAttributeSuggestions(
    lineText: string,
    cursorPos: number
  ): SuggestInformation[] {
    let suggestions: SuggestInformation[] = [];

    // Modify regex to capture the attribute query
    const attributeRegexText = `${escapeRegExp(this.startingNotation)}\\s*([a-zA-Z]*)(?=:)?`;
    const attributeRegex = new RegExp(attributeRegexText, 'g');
    const attributesInLine: string[] = Array.from(lineText.matchAll(attributeRegex)).map(
      (match) => match[1].trim()
    );
    const attributeMatch = matchByPosition(lineText, attributeRegex, cursorPos);
    if (!attributeMatch) return suggestions; // No match

    // Get the attribute query from the captured group
    const attributeQuery = attributeMatch[1].trim() || '';

    let filteredAttributes: string[] = [];
    let inputtableAttributes: string[] = [...this.inputtableAttributes];
    // Filter out attributes that already exist
    filteredAttributes = inputtableAttributes.filter((attr) =>
      !attributesInLine.includes(attr)
    )

    // Use the attributeQuery to filter the suggestions
    filteredAttributes = filteredAttributes.filter((attr) =>
      attr.startsWith(attributeQuery)
    );

    const adjustedEndPosition = adjustEndPosition(
      lineText.substring(cursorPos),
      this.endingNotation
    );
    suggestions = filteredAttributes.map((attr) => {
      return {
        displayText: attr,
        replaceText: `${this.startingNotation}${attr}: ${this.endingNotation}`,
        replaceFrom: attributeMatch.index,
        replaceTo: cursorPos + adjustedEndPosition,
        cursorPosition:
          attributeMatch.index + this.startingNotation.length + attr.length + 2
      };
    });

    return suggestions;
  }

  getPrioritySuggestions(
    lineText: string,
    cursorPos: number
  ): SuggestInformation[] {
    let suggestions: SuggestInformation[] = [];
    const priorityRegexText = `${escapeRegExp(this.startingNotation)}\\s?priority:\\s*${escapeRegExp(this.endingNotation)}`;
    const priorityRegex = new RegExp(priorityRegexText, 'g');
    const priorityMatch = matchByPosition(lineText, priorityRegex, cursorPos);
    if (!priorityMatch) return suggestions; // No match
    const prioritySelections = ['1', '2', '3', '4'];
    suggestions = prioritySelections.map((priority) => {
      const replaceText = `${this.startingNotation}priority: ${priority}${this.endingNotation}`;
      return {
        displayText: priority,
        replaceText: replaceText,
        replaceFrom: priorityMatch.index,
        replaceTo: priorityMatch.index + priorityMatch[0].length,
        cursorPosition: priorityMatch.index + replaceText.length
      };
    });

    return suggestions;
  }

  getDueSuggestions(lineText: string, cursorPos: number): SuggestInformation[] {
    let suggestions: SuggestInformation[] = [];

    // Modify regex to capture the due date query
    const dueRegexText = `${escapeRegExp(this.startingNotation)}\\s?due:\\s*${escapeRegExp(this.endingNotation)}`;
    const dueRegex = new RegExp( dueRegexText, 'g');
    const dueMatch = matchByPositionAndGroup(lineText, dueRegex, cursorPos, 1);
    if (!dueMatch) return suggestions; // No match

    // Get the due date query from the captured group
    const dueQuery = (dueMatch[1] || '').trim();

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
      'next year'
    ];

    // Use the dueQuery to filter the suggestions
    const filteredDueStrings = dueStringSelections.filter((dueString) =>
      dueString.toLowerCase().startsWith(dueQuery.toLowerCase())
    );

    suggestions = filteredDueStrings.map((dueString) => {
      const replaceText = `${this.startingNotation}due: ${dueString}${this.endingNotation}`;
      return {
        displayText: dueString,
        replaceText: replaceText,
        replaceFrom: dueMatch.index,
        replaceTo: dueMatch.index + dueMatch[0].length,
        cursorPosition: dueMatch.index + replaceText.length
      };
    });

    return suggestions;
  }

  getProjectSuggestions(
    lineText: string,
    cursorPos: number
  ): SuggestInformation[] {
    let suggestions: SuggestInformation[] = [];

    // Modify regex to capture the project name query
    const projectRegexText = `${escapeRegExp(this.startingNotation)}\\s?project:\\s*${escapeRegExp(this.endingNotation)}`;
    const projectRegex = new RegExp( projectRegexText, 'g');
    const projectMatch = matchByPositionAndGroup(
      lineText,
      projectRegex,
      cursorPos,
      1
    );
    if (!projectMatch) return suggestions; // No match

    // Get the project name query from the captured group
    const projectQuery = (projectMatch[1] || '').trim();

    // Use the projectQuery to filter the suggestions
    const filteredProjects = this.projects.filter((project) =>
      project.name.toLowerCase().startsWith(projectQuery.toLowerCase())
    );

    suggestions = filteredProjects.map((project) => {
      const replaceText = `${this.startingNotation}project: ${project.name}${this.endingNotation}`;
      return {
        displayText: project.name,
        replaceText: replaceText,
        replaceFrom: projectMatch.index,
        replaceTo: projectMatch.index + projectMatch[0].length,
        cursorPosition: projectMatch.index + replaceText.length,
        innerHTML: `${project.name}<span style="
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background-color: ${project.color};
                    margin-left: 10px;
                    vertical-align: baseline;
                    float: right;
                    "></span>`
      };
    });

    return suggestions;
  }
}

/**
 * Matches a string with a regex according to a position (typically of a cursor).
 * Will return a result only if a match exists and the given position is part of it.
 */
export function matchByPosition(
  s: string,
  r: RegExp,
  position: number
): RegExpMatchArray | void {
  const matches = [...s.matchAll(r)];
  for (const match of matches) {
    if (
      match.index !== undefined &&
      match.index <= position &&
      position <= match.index + match[0].length
    )
      return match;
  }
}

/**
 * Matches a string with a regex according to a position (typically of a cursor).
 * Will return a result only if a match exists and the given position is part of the desired matching group.
 */
export function matchByPositionAndGroup(
  s: string,
  r: RegExp,
  position: number,
  groupIndex: number
): RegExpMatchArray | void {
  const matches = [...s.matchAll(r)];

  for (const match of matches) {
    if (match.index !== undefined && match[groupIndex]) {
      const groupStartPos =
        getGroupStartIndex(match[0], r, groupIndex) + match.index;
      const groupEndPos = groupStartPos + match[groupIndex].length;

      if (position >= groupStartPos && position <= groupEndPos) {
        return match;
      }
    }
  }
}

export function adjustEndPosition(
  remainLineText: string,
  endingNotation: string
): number {
  if (!remainLineText) return 0;

  for (let i = 1; i <= endingNotation.length; i++) {
    const textAfterCursor = remainLineText.substring(0, i);

    if (endingNotation.startsWith(textAfterCursor)) {
      // Check if it's followed by a space or end of line
      const afterCheckEndPosChar = remainLineText.substring(i, i + 1);
      if (
        afterCheckEndPosChar === ' ' ||
        afterCheckEndPosChar === '\n' ||
        afterCheckEndPosChar === ''
      ) {
        return i;
      }
    }
  }
  return 0;
}
