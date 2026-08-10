import type { Writable } from 'svelte/store';
import { SettingStore, TaskCardSettings } from '../settings';
import type { Project } from '../taskModule/project';
import {
  extractEmojiFields,
  extractInlineFields,
  formatDurationValue
} from '../taskModule/fieldSyntax';
import { parseRecurrenceRule } from '../taskModule/recurrence';
import {
  SuggestFieldKey,
  SuggestInformation,
  SuggestTriggerContext
} from '.';
import {
  buildAttributeValueSuggestions,
  DURATION_OPTIONS,
  parseDurationInputValue,
  PRIORITY_OPTIONS,
  REPEAT_OPTIONS
} from './valueSuggestions';

const SUPPORTED_KEYS: SuggestFieldKey[] = [
  'due',
  'scheduled',
  'priority',
  'project',
  'repeat',
  'duration'
];

const KEY_DETAILS: Record<
  SuggestFieldKey,
  { icon: string; hint: string; sigil?: string }
> = {
  due: { icon: 'calendar-x', hint: 'deadline date', sigil: '@' },
  scheduled: {
    icon: 'calendar-clock',
    hint: 'when you plan to do it'
  },
  priority: { icon: 'flag', hint: 'highest / high / medium / low', sigil: '!' },
  project: { icon: 'folder', hint: 'assign to a project', sigil: '+' },
  repeat: { icon: 'repeat', hint: 'recurrence rule' },
  duration: { icon: 'hourglass', hint: 'time estimate' }
};

const SIGIL_TO_KEY: Record<string, Extract<SuggestFieldKey, 'due' | 'priority' | 'project'>> = {
  '@': 'due',
  '!': 'priority',
  '+': 'project'
};

type KeyStageTrigger = {
  mode: 'bracket-key';
  replaceFrom: number;
  replaceTo: number;
  query: string;
};

type ValueStageTrigger = {
  mode: 'bracket-value' | 'closed-value' | 'sigil';
  replaceFrom: number;
  replaceTo: number;
  query: string;
  key: Extract<SuggestFieldKey, 'due' | 'scheduled' | 'priority' | 'project' | 'repeat' | 'duration'>;
};

type TriggerState = KeyStageTrigger | ValueStageTrigger;

export class AttributeSuggester {
  private indicatorTag = 'TaskCard';
  private projects: Project[] = [];
  private maxNumberOfSuggestions: number;

  constructor(
    settingsStore: Writable<TaskCardSettings> = SettingStore,
    maxNumberOfSuggestions = 12
  ) {
    settingsStore.subscribe((settings) => {
      this.indicatorTag = settings.parsingSettings.indicatorTag;
      const projects = settings.userMetadata.projects;
      this.projects = Array.isArray(projects)
        ? projects
        : Object.values(projects ?? {});
    });
    this.maxNumberOfSuggestions = maxNumberOfSuggestions;
  }

  hasSuggestionTrigger(lineText: string, cursorPos: number): boolean {
    if (!this.isTaskCardTaskLine(lineText)) return false;
    return this.getTriggerState(lineText, cursorPos) !== null;
  }

  buildSuggestions(
    lineText: string,
    cursorPos: number
  ): SuggestInformation[] {
    if (!this.isTaskCardTaskLine(lineText)) return [];

    const existingKeys = this.getExistingKeys(lineText);
    const trigger = this.getTriggerState(lineText, cursorPos);
    if (!trigger) return [];

    const suggestions =
      trigger.mode === 'bracket-key'
        ? this.buildKeyStageSuggestions(trigger, existingKeys)
        : this.buildValueStageSuggestions(trigger, existingKeys);

    return suggestions.slice(0, this.maxNumberOfSuggestions);
  }

  private buildKeyStageSuggestions(
    trigger: KeyStageTrigger,
    existingKeys: Set<string>
  ): SuggestInformation[] {
    const availableKeys = SUPPORTED_KEYS.filter((key) => !existingKeys.has(key));
    const keyQuery = trigger.query.trim().toLowerCase();
    let matchedKeys = matchKeysByQuery(availableKeys, keyQuery);
    if (matchedKeys.length === 0) {
      matchedKeys = availableKeys;
    }

    const keySuggestions = matchedKeys.map((key) =>
      this.makeKeySuggestion(key, trigger.replaceFrom, trigger.replaceTo)
    );
    const quickMatches =
      keyQuery.length > 0
        ? this.buildQuickMatches(keyQuery, trigger.replaceFrom, trigger.replaceTo, existingKeys)
        : [];

    return [...keySuggestions, ...quickMatches];
  }

  private buildValueStageSuggestions(
    trigger: ValueStageTrigger,
    _existingKeys: Set<string>
  ): SuggestInformation[] {
    const valueOnly = trigger.mode === 'closed-value';
    return buildAttributeValueSuggestions(trigger.key, trigger.query, {
      projects: this.projects,
      includeDefaults: valueOnly
    }).map((suggestion) =>
      this.makeFieldSuggestion({
        key: trigger.key,
        label: suggestion.displayText,
        canonical: suggestion.value,
        replaceFrom: trigger.replaceFrom,
        replaceTo: trigger.replaceTo,
        kind: suggestion.kind === 'value' ? 'field' : suggestion.kind,
        hint: suggestion.hint,
        accentText: suggestion.accentText,
        color: suggestion.color,
        valueOnly
      })
    );
  }

  private buildQuickMatches(
    query: string,
    replaceFrom: number,
    replaceTo: number,
    existingKeys: Set<string>
  ): SuggestInformation[] {
    const quickMatches: SuggestInformation[] = [];

    const parsedDate = this.parseDateQuery(query);
    if (parsedDate) {
      for (const key of ['due', 'scheduled'] as const) {
        if (existingKeys.has(key)) continue;
        quickMatches.push(
          this.makeFieldSuggestion({
            key,
            label: parsedDate.display,
            canonical: parsedDate.canonical,
            replaceFrom,
            replaceTo,
            sectionLabel: quickMatches.length === 0 ? 'quick matches' : undefined
          })
        );
      }
    }

    if (!existingKeys.has('priority')) {
      for (const option of PRIORITY_OPTIONS) {
        if (!matchesPriorityQuery(option, query)) continue;
        quickMatches.push(
          this.makeFieldSuggestion({
            key: 'priority',
            label: option.canonical,
            canonical: option.canonical,
            replaceFrom,
            replaceTo,
            sectionLabel: quickMatches.length === 0 ? 'quick matches' : undefined
          })
        );
      }
    }

    if (!existingKeys.has('project')) {
      for (const project of this.projects) {
        if (!project?.name || !matchesPrefix(project.name, query)) continue;
        quickMatches.push(
          this.makeFieldSuggestion({
            key: 'project',
            label: project.name,
            canonical: project.name,
            replaceFrom,
            replaceTo,
            color: project.color,
            sectionLabel: quickMatches.length === 0 ? 'quick matches' : undefined
          })
        );
      }
    }

    if (!existingKeys.has('repeat')) {
      const repeatSuggestions = new Set<string>();
      for (const option of REPEAT_OPTIONS) {
        if (matchesPrefix(option, query)) {
          repeatSuggestions.add(option);
        }
      }
      const parsedRepeat = parseRecurrenceRule(query);
      if (parsedRepeat) {
        repeatSuggestions.add(parsedRepeat);
      }
      for (const option of repeatSuggestions) {
        quickMatches.push(
          this.makeFieldSuggestion({
            key: 'repeat',
            label: option,
            canonical: option,
            replaceFrom,
            replaceTo,
            sectionLabel: quickMatches.length === 0 ? 'quick matches' : undefined
          })
        );
      }
    }

    if (!existingKeys.has('duration')) {
      const durationSuggestions = new Set<string>();
      for (const option of DURATION_OPTIONS) {
        if (matchesPrefix(option, query)) {
          durationSuggestions.add(option);
        }
      }
      const parsedDuration = this.parseDurationQuery(query);
      if (parsedDuration) {
        durationSuggestions.add(parsedDuration);
      }
      for (const option of durationSuggestions) {
        quickMatches.push(
          this.makeFieldSuggestion({
            key: 'duration',
            label: option,
            canonical: option,
            replaceFrom,
            replaceTo,
            sectionLabel: quickMatches.length === 0 ? 'quick matches' : undefined
          })
        );
      }
    }

    return quickMatches;
  }

  private makeKeySuggestion(
    key: SuggestFieldKey,
    replaceFrom: number,
    replaceTo: number
  ): SuggestInformation {
    const replaceText = `[${key}:: ]`;
    return {
      kind: 'key',
      key,
      displayText: key,
      replaceText,
      replaceFrom,
      replaceTo,
      cursorPosition: replaceFrom + replaceText.length - 1,
      icon: KEY_DETAILS[key].icon,
      hint: KEY_DETAILS[key].hint,
      rightText: KEY_DETAILS[key].sigil
    };
  }

  private makeFieldSuggestion({
    key,
    label,
    canonical,
    replaceFrom,
    replaceTo,
    kind = 'field',
    hint,
    accentText,
    color,
    sectionLabel,
    valueOnly = false
  }: {
    key: SuggestFieldKey;
    label: string;
    canonical: string;
    replaceFrom: number;
    replaceTo: number;
    kind?: SuggestInformation['kind'];
    hint?: string;
    accentText?: string;
    color?: string;
    sectionLabel?: string;
    valueOnly?: boolean;
  }): SuggestInformation {
    const replaceText = valueOnly ? canonical : `[${key}:: ${canonical}] `;
    return {
      kind,
      key,
      displayText: label,
      replaceText,
      replaceFrom,
      replaceTo,
      cursorPosition: replaceFrom + replaceText.length,
      icon: KEY_DETAILS[key].icon,
      hint,
      accentText,
      color,
      sectionLabel
    };
  }

  private getTriggerState(lineText: string, cursorPos: number): TriggerState | null {
    if (cursorPos < 0 || cursorPos > lineText.length) return null;
    if (isInsideCodeSpan(lineText, cursorPos)) return null;

    const bracketTrigger = this.getBracketTrigger(lineText, cursorPos);
    if (bracketTrigger) return bracketTrigger;

    return this.getSigilTrigger(lineText, cursorPos);
  }

  private getBracketTrigger(lineText: string, cursorPos: number): TriggerState | null {
    const bracketIdx = lineText.lastIndexOf('[', cursorPos - 1);
    if (bracketIdx === -1) return null;
    // `[[` starts an Obsidian wikilink — defer to its own native autocomplete
    // rather than competing with the field-key popup.
    if (lineText[bracketIdx - 1] === '[') return null;
    const closingIdx = lineText.indexOf(']', bracketIdx + 1);

    // An existing closed field re-enters value suggestions when the cursor is
    // in its value. Selection replaces only that value, preserving brackets,
    // key spelling/aliases, surrounding text, and the block id.
    if (closingIdx !== -1) {
      if (cursorPos > closingIdx) return null;
      const fullInside = lineText.slice(bracketIdx + 1, closingIdx);
      const separatorIdx = fullInside.indexOf('::');
      if (separatorIdx === -1) return null;
      const key = normalizeKey(fullInside.slice(0, separatorIdx));
      if (!key) return null;

      let valueFrom = bracketIdx + 1 + separatorIdx + 2;
      while (valueFrom < closingIdx && /\s/.test(lineText[valueFrom])) valueFrom += 1;
      if (cursorPos < valueFrom) return null;
      return {
        mode: 'closed-value',
        key,
        replaceFrom: valueFrom,
        replaceTo: closingIdx,
        query: lineText.slice(valueFrom, cursorPos)
      };
    }

    const inside = lineText.slice(bracketIdx + 1, cursorPos);
    const separatorIdx = inside.indexOf('::');
    if (separatorIdx === -1) {
      return {
        mode: 'bracket-key',
        replaceFrom: bracketIdx,
        replaceTo: cursorPos,
        query: inside
      };
    }

    const key = normalizeKey(inside.slice(0, separatorIdx));
    if (!key) return null;

    return {
      mode: 'bracket-value',
      key,
      replaceFrom: bracketIdx,
      replaceTo: cursorPos,
      query: inside.slice(separatorIdx + 2).replace(/^\s+/, '')
    };
  }

  private getSigilTrigger(lineText: string, cursorPos: number): TriggerState | null {
    if (isInsideClosedField(lineText, cursorPos)) return null;

    const prefix = lineText.slice(0, cursorPos);
    const match = prefix.match(/(^|[\s([{>])([!@+])([^\s\]]*)$/);
    if (!match) return null;

    const sigil = match[2];
    const key = SIGIL_TO_KEY[sigil];
    if (!key) return null;
    if (this.getExistingKeys(lineText).has(key)) return null;

    return {
      mode: 'sigil',
      key,
      replaceFrom: prefix.length - match[2].length - match[3].length,
      replaceTo: cursorPos,
      query: match[3]
    };
  }

  private getExistingKeys(lineText: string): Set<string> {
    const keys = new Set(Object.keys(extractInlineFields(lineText).known));
    // Tasks-emoji-dialect fields (📅 due, ⏫ priority, 🔁 repeat, …) are a
    // first-class preserved input state (docs/format-spec.md § Parse matrix):
    // union their keys in so a line already carrying an emoji signifier
    // never also gets offered a conflicting `[key:: value]` for the same field.
    const emoji = extractEmojiFields(lineText);
    for (const key of Object.keys(emoji.known)) {
      keys.add(key);
    }
    if (emoji.priority !== null) {
      keys.add('priority');
    }
    return keys;
  }

  private isTaskCardTaskLine(lineText: string): boolean {
    if (!/^\s*- \[[^\]]\]\s/.test(lineText)) return false;
    return new RegExp(`#${escapeForRegex(this.indicatorTag)}(?![A-Za-z0-9_/-])`).test(
      lineText
    );
  }

  private parseDateQuery(
    rawQuery: string
  ): { display: string; canonical: string } | null {
    const parsed = buildAttributeValueSuggestions('due', rawQuery).find(
      (suggestion) => suggestion.kind === 'date-preview'
    );
    return parsed
      ? { display: parsed.displayText, canonical: parsed.value }
      : null;
  }

  private parseDurationQuery(rawQuery: string): string | null {
    const query = rawQuery.trim();
    if (!query) return null;
    const duration = parseDurationInputValue(query);
    return duration ? formatDurationValue(duration) : null;
  }
}

function normalizeKey(rawKey: string): SuggestFieldKey | null {
  const normalized = rawKey.trim().toLowerCase();
  if (normalized === 'schedule') return 'scheduled';
  return SUPPORTED_KEYS.includes(normalized as SuggestFieldKey)
    ? (normalized as SuggestFieldKey)
    : null;
}

/**
 * Rank key candidates for a partial query. A plain subsequence fallback
 * (used unconditionally before this fix) drags in unrelated keys even once
 * the query exactly spells out a real key name — e.g. `due` subsequence-
 * matches `scheduled` too. Once the query exactly names a key, the intent is
 * unambiguous, so restrict to keys sharing that exact prefix (in practice
 * just the one key) instead of also surfacing fuzzy subsequence noise.
 * Shorter, still-ambiguous queries (`du`, `pro`) keep the broader
 * prefix-or-subsequence behavior, since prefix matches are always a subset
 * of subsequence matches.
 */
function matchKeysByQuery<T extends string>(keys: T[], query: string): T[] {
  if (!query) return keys;
  if ((keys as string[]).includes(query)) {
    return keys.filter((key) => key.startsWith(query));
  }
  return keys.filter((key) => isSubsequence(query, key));
}

function matchesPrefix(value: string, query: string): boolean {
  const normalizedValue = value.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return normalizedValue.startsWith(normalizedQuery);
}

function matchesPriorityQuery(
  option: (typeof PRIORITY_OPTIONS)[number],
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return option.aliases.some((alias) => alias.startsWith(normalizedQuery));
}

function isSubsequence(query: string, candidate: string): boolean {
  let idx = 0;
  for (const char of candidate) {
    if (char === query[idx]) idx += 1;
    if (idx === query.length) return true;
  }
  return idx === query.length;
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isInsideCodeSpan(lineText: string, cursorPos: number): boolean {
  const prefix = lineText.slice(0, cursorPos);
  const backticks = prefix.match(/`/g);
  return !!backticks && backticks.length % 2 === 1;
}

function isInsideClosedField(lineText: string, cursorPos: number): boolean {
  const fieldRegex = /\[[A-Za-z][A-Za-z0-9_-]*::[^\]]*\]/g;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (cursorPos > start && cursorPos <= end) {
      return true;
    }
  }
  return false;
}

export function getSuggestionContext(
  lineText: string,
  cursorPos: number,
  suggester: AttributeSuggester
): SuggestTriggerContext | null {
  if (!suggester.hasSuggestionTrigger(lineText, cursorPos)) return null;
  return { lineText, cursorPos };
}
