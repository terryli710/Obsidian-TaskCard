import { Priority, ScheduleDate, Duration } from './task';
import { escapeRegExp } from '../utils/regexUtils';

/**
 * TaskCard v2 on-disk syntax (docs/format-spec.md): visible Dataview inline
 * fields `[key:: value]` on the task line, a native block id (`^tc-xxxxxx`)
 * as the task's stable identity, and no hidden HTML. This module holds the
 * pure string-level helpers shared by the parser, formatter, monitor, and
 * identity resolution.
 */

export const TASK_ID_PREFIX = 'tc-';

/** Canonical field keys TaskCard understands (Tasks-plugin dataview-mode
 *  names wherever the concept overlaps). */
export const KNOWN_FIELD_KEYS = [
  'priority',
  'due',
  'scheduled',
  'duration',
  'repeat',
  'project',
  'completion'
] as const;
export type KnownFieldKey = (typeof KNOWN_FIELD_KEYS)[number];

/** Aliases accepted on read, normalized to a canonical key. */
const FIELD_KEY_ALIASES: Record<string, KnownFieldKey> = {
  schedule: 'scheduled', // TaskCard v1 attribute name
  recurrence: 'repeat' // TaskCard v1 attribute name
};

export function normalizeFieldKey(key: string): KnownFieldKey | null {
  const normalized = key.trim().toLowerCase();
  return (
    FIELD_KEY_ALIASES[normalized] ??
    (KNOWN_FIELD_KEYS.includes(normalized as KnownFieldKey)
      ? (normalized as KnownFieldKey)
      : null)
  );
}

export function mintTaskId(): string {
  // 6 base36 chars ≈ 2.2e9 combinations — ample for one vault
  let suffix = '';
  while (suffix.length < 6) {
    suffix += Math.random().toString(36).slice(2);
  }
  return TASK_ID_PREFIX + suffix.slice(0, 6);
}

export function isV2TaskId(id: string | null | undefined): boolean {
  return typeof id === 'string' && /^tc-[a-z0-9]{4,}$/.test(id);
}

/**
 * The literal token whose presence on a line identifies a task by id:
 * v2 ids are block ids (`^tc-xxxxxx`); legacy uuids live inside the v1
 * hidden-span JSON (`"id":"<uuid>"`).
 */
export function taskIdToken(id: string): string {
  return isV2TaskId(id) ? `^${id}` : `"id":"${id}"`;
}

const BLOCK_ID_AT_END = /\s+\^([A-Za-z0-9-]+)\s*$/;

/** Split a trailing Obsidian block id off a task line. */
export function extractBlockId(line: string): {
  id: string | null;
  rest: string;
} {
  const match = line.match(BLOCK_ID_AT_END);
  if (!match) return { id: null, rest: line };
  return { id: match[1], rest: line.slice(0, match.index).trimEnd() };
}

export function appendBlockId(line: string, id: string): string {
  return `${line.trimEnd()} ^${id}`;
}

export interface ExtractedFields {
  /** canonical key → raw value, for keys TaskCard understands */
  known: Partial<Record<KnownFieldKey, string>>;
  /** raw `[key:: value]` strings preserved verbatim across rewrites */
  foreign: string[];
  /** the line with all fields removed */
  rest: string;
}

const BRACKET_FIELD = /\[([A-Za-z][A-Za-z0-9_-]*)::\s*([^\]]*)\]/g;
const PAREN_FIELD = /\(([A-Za-z][A-Za-z0-9_-]*)::\s*([^)]*)\)/g;

export interface InlineFieldSpan {
  raw: string;
  key: string;
  canonicalKey: KnownFieldKey | null;
  value: string;
  from: number;
  to: number;
}

/**
 * Pull all Dataview inline fields (`[key:: value]` and `(key:: value)`) out
 * of a task line. Unknown keys (Tasks' `start::`, `created::`, `id::`,
 * user-custom fields, …) are kept verbatim so a rewrite never drops them.
 */
export function extractInlineFields(text: string): ExtractedFields {
  const known: Partial<Record<KnownFieldKey, string>> = {};
  const foreign: string[] = [];

  const consume = (source: string, pattern: RegExp): string =>
    source.replace(pattern, (raw, key: string, value: string) => {
      const canonical = normalizeFieldKey(key);
      if (canonical) {
        if (known[canonical] === undefined) known[canonical] = value.trim();
      } else {
        foreign.push(raw);
      }
      return ' ';
    });

  let rest = consume(text, BRACKET_FIELD);
  rest = consume(rest, PAREN_FIELD);
  return { known, foreign, rest: rest.replace(/\s{2,}/g, ' ').trimEnd() };
}

export function findInlineFieldSpans(text: string): InlineFieldSpan[] {
  const spans: InlineFieldSpan[] = [];
  const patterns = [BRACKET_FIELD, PAREN_FIELD];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      spans.push({
        raw: match[0],
        key: match[1],
        canonicalKey: normalizeFieldKey(match[1]),
        value: match[2].trim(),
        from: match.index,
        to: match.index + match[0].length
      });
    }
  }

  return spans.sort((a, b) => a.from - b.from);
}

export interface TextSpan {
  from: number;
  to: number;
}

export function findIndicatorTagSpan(
  text: string,
  indicatorTag: string
): TextSpan | null {
  const pattern = new RegExp(
    `#${escapeRegExp(indicatorTag)}(?![A-Za-z0-9_/-])`
  );
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return null;
  return { from: match.index, to: match.index + match[0].length };
}

export function findBlockIdSpan(
  text: string
): (TextSpan & { id: string }) | null {
  const match = BLOCK_ID_AT_END.exec(text);
  if (!match || match.index === undefined) return null;
  const caretIndex = match.index + match[0].indexOf('^');
  return {
    id: match[1],
    from: caretIndex,
    to: caretIndex + match[0].trim().length
  };
}

/** Tasks-plugin emoji signifiers → canonical/foreign fields. */
const EMOJI_DATE_KEYS: Record<string, KnownFieldKey | 'start' | 'created' | 'cancelled'> = {
  '📅': 'due',
  '🗓': 'due',
  '⏳': 'scheduled',
  '⌛': 'scheduled',
  '✅': 'completion',
  '🛫': 'start',
  '➕': 'created',
  '❌': 'cancelled'
};

const EMOJI_PRIORITY: Record<string, Priority> = {
  '🔺': 1, // highest
  '⏫': 2, // high
  '🔼': 3, // medium
  '🔽': 4, // low
  '⏬': 4 // lowest
};

/** Matches any Tasks-format emoji signifier (used to detect foreign dialect). */
export const TASKS_EMOJI_SIGNIFIER =
  /[📅🗓⏳⌛✅🛫➕❌🔺⏫🔼🔽⏬🔁]/u;

const EMOJI_DATE_FIELD =
  /([📅🗓⏳⌛✅🛫➕❌])️?\s*(\d{4}-\d{2}-\d{2})/gu;
const EMOJI_PRIORITY_FIELD = /([🔺⏫🔼🔽⏬])️?/gu;
// recurrence text runs until the next emoji signifier, inline field, or EOL
const EMOJI_RECURRENCE_FIELD =
  /🔁️?\s*([^📅🗓⏳⌛✅🛫➕❌🔺⏫🔼🔽⏬🔁[(]*)/u;

export interface ExtractedEmojiFields {
  known: Partial<Record<KnownFieldKey, string>>;
  priority: Priority | null;
  /** unknown emoji concepts, already converted to `[key:: value]` strings */
  foreign: string[];
  rest: string;
}

/**
 * Parse Tasks-emoji-format signifiers so existing Tasks users' lines render
 * as cards without migration (docs/format-spec.md § Parse matrix).
 *
 * `validateRecurrence` guards the 🔁 signifier: when the trailing text is not
 * a valid rule, it stays in the content instead of being consumed.
 */
export function extractEmojiFields(
  text: string,
  validateRecurrence?: (rule: string) => boolean
): ExtractedEmojiFields {
  const known: Partial<Record<KnownFieldKey, string>> = {};
  const foreign: string[] = [];
  let priority: Priority | null = null;

  let rest = text.replace(EMOJI_DATE_FIELD, (_raw, emoji: string, date: string) => {
    const key = EMOJI_DATE_KEYS[emoji];
    if (key === 'start' || key === 'created' || key === 'cancelled') {
      foreign.push(`[${key}:: ${date}]`);
    } else if (key && known[key] === undefined) {
      known[key] = date;
    }
    return ' ';
  });

  rest = rest.replace(EMOJI_PRIORITY_FIELD, (_raw, emoji: string) => {
    if (priority === null) priority = EMOJI_PRIORITY[emoji] ?? null;
    return ' ';
  });

  const recurrenceMatch = rest.match(EMOJI_RECURRENCE_FIELD);
  if (recurrenceMatch) {
    const rule = recurrenceMatch[1].trim();
    const ruleIsUsable =
      rule.length > 0 && (!validateRecurrence || validateRecurrence(rule));
    if (ruleIsUsable) {
      if (known.repeat === undefined) known.repeat = rule;
      rest =
        rest.slice(0, recurrenceMatch.index) +
        ' ' +
        rest.slice(recurrenceMatch.index + recurrenceMatch[0].length);
    }
  }

  return {
    known,
    priority,
    foreign,
    rest: rest.replace(/\s{2,}/g, ' ').trimEnd()
  };
}

/** Tasks-plugin priority vocabulary ↔ TaskCard's 1–4 scale. */
export function priorityWordToNumber(value: string): Priority | null {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'highest':
      return 1;
    case 'high':
      return 2;
    case 'medium':
      return 3;
    case 'low':
    case 'lowest':
    case 'none':
      return 4;
  }
  if (/^[1-4]$/.test(normalized)) return Number(normalized) as Priority;
  return null;
}

/** null means "default — omit the field on disk". */
export function priorityNumberToWord(priority: Priority): string | null {
  switch (priority) {
    case 1:
      return 'highest';
    case 2:
      return 'high';
    case 3:
      return 'medium';
    default:
      return null;
  }
}

const ISO_DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?$/;

/** Fast-path parse of the canonical date grammar (`YYYY-MM-DD[THH:mm]`). */
export function parseIsoScheduleValue(value: string): ScheduleDate | null {
  const match = value.trim().match(ISO_DATE_TIME);
  if (!match) return null;
  return {
    isRecurring: false,
    date: match[1],
    ...(match[2] ? { time: match[2] } : {}),
    string: value.trim()
  };
}

export function formatScheduleValue(sd: ScheduleDate): string {
  return sd.time ? `${sd.date}T${sd.time}` : sd.date;
}

export function formatDurationValue(duration: Duration): string | null {
  const hours = duration.hours || 0;
  const minutes = duration.minutes || 0;
  if (hours === 0 && minutes === 0) return null;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes}m`;
}

export function formatInlineField(key: string, value: string): string {
  return `[${key}:: ${value}]`;
}
