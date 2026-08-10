import moment from 'moment';
import parse from 'parse-duration';
import type { Project } from '../taskModule/project';
import { formatDurationValue, formatScheduleValue } from '../taskModule/fieldSyntax';
import { parseRecurrenceRule } from '../taskModule/recurrence';
import type { Duration } from '../taskModule/task';
import { parseScheduleInput } from '../taskModule/temporal';
import type { SuggestFieldKey } from '.';

export type AttributeValueKey = SuggestFieldKey | 'label';

export interface AttributeValueSuggestion {
  kind: 'value' | 'value-preview' | 'date-preview' | 'date-option';
  key: AttributeValueKey;
  displayText: string;
  value: string;
  hint?: string;
  accentText?: string;
  color?: string;
}

export interface ValueSuggestionOptions {
  projects?: Project[];
  labels?: string[];
  /** Show the stable shortcuts even when they do not match the query. */
  includeDefaults?: boolean;
}

export const PRIORITY_OPTIONS = [
  { canonical: 'highest', aliases: ['highest', 'p1', '1'] },
  { canonical: 'high', aliases: ['high', 'p2', '2'] },
  { canonical: 'medium', aliases: ['medium', 'med', 'p3', '3'] },
  { canonical: 'low', aliases: ['low', 'lowest', 'none', 'p4', '4'] }
] as const;

export const REPEAT_OPTIONS = [
  'every day',
  'every week',
  'every weekday',
  'every month'
];

export const DURATION_OPTIONS = ['15m', '30m', '1h', '2h'];
export const DATE_SHORTCUTS = ['today', 'tomorrow', 'next week'];

function matchesPrefix(value: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return !normalizedQuery || value.trim().toLowerCase().startsWith(normalizedQuery);
}

function formatDatePreview(value: ReturnType<typeof parseScheduleInput>): string {
  if (!value) return '';
  const date = moment(
    value.time ? `${value.date}T${value.time}` : value.date,
    value.time ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD',
    true
  );
  const dateText = date.format('ddd, MMM D');
  return value.time ? `${dateText}, ${date.format('h:mm A')}` : dateText;
}

export function parseDurationInputValue(rawQuery: string): Duration | null {
  const query = rawQuery.trim();
  if (!query) return null;

  const clockMatch = query.match(/^(\d+):(\d{1,2})$/);
  if (clockMatch) {
    const hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2]);
    if (minutes >= 60) return null;
    if (hours === 0 && minutes === 0) return { hours: 0, minutes: 0 };
    return { hours, minutes };
  }

  // parse-duration interprets a bare number as milliseconds. In TaskCard's
  // guided editor a bare number consistently means minutes instead.
  const isBareNumber = /^\d+(?:\.\d+)?$/.test(query);
  const parsedMinutes = isBareNumber ? parse(`${query}m`, 'm') : parse(query, 'm');
  if (
    parsedMinutes === null ||
    parsedMinutes === undefined ||
    Number.isNaN(parsedMinutes)
  ) {
    return null;
  }

  const minutes = Math.round(parsedMinutes);
  if (minutes <= 0) return null;
  if (isBareNumber) return { hours: 0, minutes };
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export function buildAttributeValueSuggestions(
  key: AttributeValueKey,
  rawQuery: string,
  options: ValueSuggestionOptions = {}
): AttributeValueSuggestion[] {
  const query = rawQuery.trim();
  const includeDefaults = options.includeDefaults ?? false;

  if (key === 'due' || key === 'scheduled') {
    const suggestions: AttributeValueSuggestion[] = [];
    const parsed = parseScheduleInput(query);
    if (parsed) {
      const display = formatDatePreview(parsed);
      suggestions.push({
        kind: 'date-preview',
        key,
        displayText: display,
        accentText: `→ ${display}`,
        value: formatScheduleValue(parsed)
      });
    }

    const shortcuts = DATE_SHORTCUTS.filter(
      (shortcut) => includeDefaults || matchesPrefix(shortcut, query)
    );
    for (const shortcut of shortcuts) {
      const value = parseScheduleInput(shortcut);
      if (!value) continue;
      suggestions.push({
        kind: 'date-option',
        key,
        displayText: shortcut,
        hint: formatDatePreview(value),
        value: formatScheduleValue(value)
      });
    }
    return suggestions;
  }

  if (key === 'priority') {
    const normalized = query.toLowerCase();
    return PRIORITY_OPTIONS.filter(
      (option) =>
        includeDefaults ||
        !normalized ||
        option.aliases.some((alias) => alias.startsWith(normalized))
    ).map((option) => ({
      kind: 'value',
      key,
      displayText: option.canonical,
      value: option.canonical
    }));
  }

  if (key === 'project') {
    return (options.projects ?? [])
      .filter((project) => project?.name && (includeDefaults || matchesPrefix(project.name, query)))
      .map((project) => ({
        kind: 'value',
        key,
        displayText: project.name,
        value: project.name,
        color: project.color
      }));
  }

  if (key === 'repeat') {
    const values = new Set<string>();
    const parsed = parseRecurrenceRule(query);
    const suggestions: AttributeValueSuggestion[] = [];
    if (includeDefaults && parsed) {
      suggestions.push({
        kind: 'value-preview',
        key,
        displayText: parsed,
        accentText: `→ ${parsed}`,
        value: parsed
      });
    }
    for (const option of REPEAT_OPTIONS) {
      if (!query || matchesPrefix(option, query)) values.add(option);
    }
    if (parsed && !includeDefaults) values.add(parsed);
    return suggestions.concat(
      Array.from(values)
        .filter((value) => !includeDefaults || value !== parsed)
        .map((value) => ({
          kind: 'value' as const,
          key,
          displayText: value,
          value
        }))
    );
  }

  if (key === 'duration') {
    const values = new Set<string>();
    const parsed = parseDurationInputValue(query);
    const canonical = parsed ? formatDurationValue(parsed) : null;
    const suggestions: AttributeValueSuggestion[] = [];
    if (includeDefaults && canonical) {
      suggestions.push({
        kind: 'value-preview',
        key,
        displayText: canonical,
        accentText: `→ ${canonical}`,
        value: canonical
      });
    }
    for (const option of DURATION_OPTIONS) {
      if (includeDefaults || matchesPrefix(option, query)) values.add(option);
    }
    if (canonical && !includeDefaults) values.add(canonical);
    return suggestions.concat(
      Array.from(values)
        .filter((value) => !includeDefaults || value !== canonical)
        .map((value) => ({
          kind: 'value' as const,
          key,
          displayText: value,
          value
        }))
    );
  }

  const normalizedQuery = query.replace(/^#/, '').toLowerCase();
  return Array.from(new Set(options.labels ?? []))
    .map((label) => label.replace(/^#/, ''))
    .filter(
      (label) =>
        label &&
        (includeDefaults || !normalizedQuery || label.toLowerCase().startsWith(normalizedQuery))
    )
    .sort((a, b) => a.localeCompare(b))
    .map((label) => ({
      kind: 'value',
      key,
      displayText: `#${label}`,
      value: label
    }));
}
