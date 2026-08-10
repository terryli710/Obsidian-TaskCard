import parseDuration from 'parse-duration';
import { RRule } from 'rrule';
import { ObsidianTask, Priority, ScheduleDate, Duration } from '../taskModule/task';
import { Project } from '../taskModule/project';
import { parseRecurrenceRule } from '../taskModule/recurrence';
import { parseScheduleInput } from '../taskModule/temporal';

export type QuickAddTokenType =
  | 'due'
  | 'duration'
  | 'repeat'
  | 'priority'
  | 'label'
  | 'project';

export type QuickAddToken = {
  type: QuickAddTokenType;
  start: number;
  end: number;
  display: string;
  canonical: string | Priority | ScheduleDate | Duration | Project;
};

export type QuickAddParseResult = {
  tokens: QuickAddToken[];
  residualContent: string;
};

const DATE_START_RE =
  /^(?:today|tomorrow|tonight|yesterday|noon|midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu(?:rs)?|fri|sat|sun|next|this|on|in|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|\d{1,4}[:/-]\d{1,2}(?:[:/-]\d{1,4})?|\d{1,2}(?::\d{2})?(?:am|pm)?|\d{4}-\d{2}-\d{2})$/i;
const DURATION_START_RE = /^(?:for|\d)/i;
const DURATION_PHRASE_RE =
  /^(?:for\s+)?(?:(?:\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours))(?:\s+\d+\s*(?:m|min|mins|minute|minutes))?|\d+\s*(?:m|min|mins|minute|minutes))$/i;
const LABEL_RE = /^#[A-Za-z][\w/-]*$/;
const PROJECT_RE = /^@([^\s#@!]+)$/;
const PRIORITY_PATTERNS: Array<{ re: RegExp; canonical: Priority }> = [
  { re: /^!!$/i, canonical: 1 },
  { re: /^!high$/i, canonical: 2 },
  { re: /^!medium$/i, canonical: 3 },
  { re: /^!low$/i, canonical: 4 },
  { re: /^p1$/i, canonical: 1 },
  { re: /^p2$/i, canonical: 2 },
  { re: /^p3$/i, canonical: 3 }
];

function isBoundary(input: string, index: number): boolean {
  return index === 0 || /\s/.test(input[index - 1]);
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseScheduleValue(value: string): ScheduleDate | null {
  return parseScheduleInput(value);
}

function parseDurationValue(value: string): Duration | null {
  const minutes = parseDuration(value, 'm');
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return null;
  }

  const totalMinutes = Number(minutes);
  if (totalMinutes <= 0) return null;

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}

function wordBoundaries(input: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const wordRe = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = wordRe.exec(input)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function getWordRangesFrom(input: string, index: number): Array<{ start: number; end: number }> {
  return wordBoundaries(input).filter((range) => range.start >= index);
}

function tryPriority(input: string, index: number): QuickAddToken | null {
  const end = nextBoundaryIndex(input, index);
  const candidate = input.slice(index, end);
  for (const pattern of PRIORITY_PATTERNS) {
    if (pattern.re.test(candidate)) {
      return {
        type: 'priority',
        start: index,
        end,
        display: candidate,
        canonical: pattern.canonical
      };
    }
  }
  return null;
}

function tryLabel(input: string, index: number): QuickAddToken | null {
  const end = nextBoundaryIndex(input, index);
  const candidate = input.slice(index, end);
  if (!LABEL_RE.test(candidate)) return null;
  return {
    type: 'label',
    start: index,
    end,
    display: candidate,
    canonical: candidate
  };
}

/**
 * The configured indicator tag (`#TaskCard` by default) is never a user
 * label — TaskFormatter always appends it itself, so keeping it here would
 * write it twice. Matched the same way TaskParser strips it from parsed
 * labels: an exact, case-sensitive `#tag` match.
 */
function tryIndicatorTagSpan(
  input: string,
  index: number,
  indicatorTag: string
): { start: number; end: number } | null {
  const end = nextBoundaryIndex(input, index);
  const candidate = input.slice(index, end);
  if (candidate !== `#${indicatorTag}`) return null;
  return { start: index, end };
}

function tryProject(
  input: string,
  index: number,
  projects: Project[]
): QuickAddToken | null {
  const end = nextBoundaryIndex(input, index);
  const candidate = input.slice(index, end);
  const match = candidate.match(PROJECT_RE);
  if (!match) return null;
  const project = projects.find(
    (entry) => entry.name.toLowerCase() === match[1].toLowerCase()
  );
  if (!project) return null;
  return {
    type: 'project',
    start: index,
    end,
    display: candidate,
    canonical: project
  };
}

function tryRecurrence(input: string, index: number): QuickAddToken | null {
  if (!input.slice(index).toLowerCase().startsWith('every ')) return null;
  const ranges = getWordRangesFrom(input, index);
  let best: QuickAddToken | null = null;
  for (let count = 2; count <= Math.min(ranges.length, 8); count++) {
    const end = ranges[count - 1].end;
    const candidate = input.slice(index, end);
    const canonical = parseRecurrenceRule(candidate);
    if (!canonical) continue;
    if (RRule.parseText(canonical)) {
      best = {
        type: 'repeat',
        start: index,
        end,
        display: candidate,
        canonical
      };
    }
  }
  return best;
}

function tryDuration(input: string, index: number): QuickAddToken | null {
  const ranges = getWordRangesFrom(input, index);
  if (ranges.length === 0) return null;
  const firstWord = input.slice(ranges[0].start, ranges[0].end);
  if (!DURATION_START_RE.test(firstWord)) return null;

  let best: QuickAddToken | null = null;
  for (let count = 1; count <= Math.min(ranges.length, 3); count++) {
    const end = ranges[count - 1].end;
    const candidate = input.slice(index, end);
    if (!DURATION_PHRASE_RE.test(candidate)) continue;
    const stripped = candidate.replace(/^for\s+/i, '');
    const canonical = parseDurationValue(stripped);
    if (!canonical) continue;
    best = {
      type: 'duration',
      start: index,
      end,
      display: candidate,
      canonical
    };
  }
  return best;
}

function tryDue(input: string, index: number): QuickAddToken | null {
  const ranges = getWordRangesFrom(input, index);
  if (ranges.length === 0) return null;
  const firstWord = input.slice(ranges[0].start, ranges[0].end);
  if (!DATE_START_RE.test(firstWord)) return null;

  let best: QuickAddToken | null = null;
  for (let count = 1; count <= Math.min(ranges.length, 5); count++) {
    const end = ranges[count - 1].end;
    const candidate = input.slice(index, end);
    const canonical = parseScheduleValue(candidate);
    if (!canonical) continue;
    best = {
      type: 'due',
      start: index,
      end,
      display: candidate,
      canonical
    };
  }
  return best;
}

function nextBoundaryIndex(input: string, index: number): number {
  let end = index;
  while (end < input.length && !/\s/.test(input[end])) end++;
  return end;
}

export function tokenizeQuickAddInput(
  input: string,
  projects: Project[],
  indicatorTag: string
): QuickAddParseResult {
  const tokens: QuickAddToken[] = [];
  const skippedSpans: Array<{ start: number; end: number }> = [];
  let index = 0;

  while (index < input.length) {
    if (!isBoundary(input, index) || /\s/.test(input[index])) {
      index++;
      continue;
    }

    const indicatorTagSpan = tryIndicatorTagSpan(input, index, indicatorTag);
    if (indicatorTagSpan) {
      skippedSpans.push(indicatorTagSpan);
      index = indicatorTagSpan.end;
      continue;
    }

    const token =
      tryPriority(input, index) ??
      tryLabel(input, index) ??
      tryProject(input, index, projects) ??
      tryRecurrence(input, index) ??
      tryDuration(input, index) ??
      tryDue(input, index);

    if (!token) {
      index++;
      continue;
    }

    tokens.push(token);
    index = token.end;
  }

  return {
    tokens,
    residualContent: buildResidualContent(input, [...tokens, ...skippedSpans])
  };
}

export function buildResidualContent(
  input: string,
  tokens: Array<Pick<QuickAddToken, 'start' | 'end'>>
): string {
  if (tokens.length === 0) return collapseWhitespace(input);

  let output = '';
  let cursor = 0;
  for (const token of [...tokens].sort((a, b) => a.start - b.start)) {
    output += input.slice(cursor, token.start);
    cursor = token.end;
  }
  output += input.slice(cursor);
  return collapseWhitespace(output);
}

export function removeTokenSpanFromInput(
  input: string,
  token: Pick<QuickAddToken, 'start' | 'end'>
): string {
  return buildResidualContent(input, [token]);
}

export function buildTaskFromQuickAdd(
  input: string,
  projects: Project[],
  indicatorTag: string,
  taskId?: string | null
): {
  task: ObsidianTask;
  tokens: QuickAddToken[];
  residualContent: string;
} {
  const result = tokenizeQuickAddInput(input, projects, indicatorTag);
  const task = new ObsidianTask({
    id: taskId || '',
    content: result.residualContent,
    labels: result.tokens
      .filter((token) => token.type === 'label')
      .map((token) => token.canonical as string),
    completed: false
  });

  for (const token of result.tokens) {
    switch (token.type) {
      case 'due':
        if (!task.due) task.due = token.canonical as ScheduleDate;
        break;
      case 'duration':
        if (!task.duration) task.duration = token.canonical as Duration;
        break;
      case 'repeat':
        if (!task.recurrence) task.recurrence = token.canonical as string;
        break;
      case 'priority':
        if (!task.priority || task.priority === 4) {
          task.priority = token.canonical as Priority;
        }
        break;
      case 'project':
        if (!task.project?.name) task.project = token.canonical as Project;
        break;
      case 'label':
        break;
    }
  }

  return {
    task,
    tokens: result.tokens,
    residualContent: result.residualContent
  };
}
