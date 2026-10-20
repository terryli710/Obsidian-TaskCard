import { RRule } from 'rrule';
import { moment } from '../utils/obsidianMoment';
import { ObsidianTask, ScheduleDate } from './task';
import { extractBlockId, findInlineFieldSpans, isV2TaskId, mintTaskId, hasTaskIdentity } from './fieldSyntax';
import type TaskCardPlugin from '..';
import { logger } from '../utils/log';
import { countTaskDescriptionLines, parseTaskLine } from '../utils/taskLine';
import { FileWriteConflict } from '../renderer/fileOperator';
import { markdownSourceContext } from '../utils/markdownSourceContext';
import { protectMarkdownSyntax } from '../utils/markdownSyntax';

/**
 * Recurrence support. Rules use the Tasks-plugin grammar (rrule natural
 * language, e.g. "every 2 weeks on Monday") and are stored on the task as the
 * normalized human-readable string produced by rrule's toText().
 */

/**
 * Validate + normalize a natural-language recurrence rule.
 * Returns the normalized rule text, or null when the text is not a valid rule.
 */
export function parseRecurrenceRule(text: string): string | null {
  if (!text || !text.trim()) return null;
  try {
    const options = RRule.parseText(text.trim());
    if (!options || Object.keys(options).length === 0) return null;
    const normalized = new RRule(options).toText();
    if (!normalized || !normalized.trim()) return null;
    // Reject rules that don't survive a round-trip (toText can emit
    // approximations for options its grammar cannot express).
    if (!RRule.parseText(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

/**
 * The next occurrence date strictly after the reference date, as YYYY-MM-DD.
 * Dates are computed in UTC (rrule best practice) so results are
 * timezone-independent.
 */
export function nextOccurrenceDate(
  ruleText: string,
  referenceDate: string
): string | null {
  try {
    const options = RRule.parseText(ruleText);
    if (!options) return null;
    const [y, m, d] = referenceDate.split('-').map(Number);
    options.dtstart = new Date(Date.UTC(y, m - 1, d));
    const rule = new RRule(options);
    const next = rule.after(options.dtstart, false);
    if (!next) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(
      next.getUTCDate()
    )}`;
  } catch (e) {
    logger.warn(`Failed to compute next occurrence for "${ruleText}": ${e}`);
    return null;
  }
}

function shiftScheduleDate(sd: ScheduleDate, deltaDays: number): ScheduleDate {
  const newDate = moment(sd.date, 'YYYY-MM-DD')
    .add(deltaDays, 'days')
    .format('YYYY-MM-DD');
  return {
    ...sd,
    date: newDate,
    // the original natural-language string ("tomorrow") is stale now
    string: sd.time ? `${newDate} ${sd.time}` : newDate
  };
}

/** Uncheck any completed subtask checkboxes in a description block. */
export function resetDescriptionCheckboxes(description: string, parentLine?: string): string {
  const lines = description.split('\n');
  const offset = parentLine === undefined ? 0 : 1;
  const context = markdownSourceContext(parentLine === undefined ? lines : [parentLine, ...lines]);
  return lines.map((line, index) => {
    if (!context.taskLines.has(index + offset)) return line;
    const parsed = parseTaskLine(line);
    return parsed && /^[xX]$/.test(parsed.status)
      ? line.slice(0, parsed.statusOffset) + ' ' + line.slice(parsed.statusOffset + 1) : line;
  }).join('\n');
}

/**
 * Build the next instance of a recurring task:
 * - schedule (or due, when there is no schedule) advances to the rule's next
 *   occurrence; the other date field shifts by the same number of days so
 *   relative offsets are preserved; times are kept.
 * - a task with no dates gets a schedule at the next occurrence after today.
 * - completed is reset, description checkboxes are unchecked, the instance
 *   gets a fresh id, and external sync mappings are dropped (the new instance
 *   is a new task for external providers).
 * Returns null when the task has no (valid) recurrence rule.
 */
export function advanceRecurringTask(task: ObsidianTask): ObsidianTask | null {
  if (!task.recurrence) return null;

  const reference: ScheduleDate | null = task.schedule?.date
    ? task.schedule
    : task.due?.date
    ? task.due
    : null;
  const referenceDate = reference
    ? reference.date
    : moment().format('YYYY-MM-DD');

  const nextDate = nextOccurrenceDate(task.recurrence, referenceDate);
  if (!nextDate) return null;
  const deltaDays = moment(nextDate, 'YYYY-MM-DD').diff(
    moment(referenceDate, 'YYYY-MM-DD'),
    'days'
  );

  const nextTask = task.getCopy();
  nextTask.id = mintTaskId();
  nextTask.completed = false;
  nextTask.completionDate = null;
  nextTask.description = resetDescriptionCheckboxes(task.description);

  if (task.schedule?.date) {
    nextTask.schedule = shiftScheduleDate(task.schedule, deltaDays);
  }
  if (task.due?.date) {
    nextTask.due = shiftScheduleDate(task.due, deltaDays);
  }
  if (!task.schedule?.date && !task.due?.date) {
    nextTask.schedule = {
      isRecurring: false,
      date: nextDate,
      string: nextDate
    };
  }

  const metadata = { ...(task.metadata ?? {}) };
  delete metadata.syncMappings;
  nextTask.metadata = metadata;

  return nextTask;
}

/** Actual legacy metadata spans, excluding quoted code/link/comment examples. */
function legacyMetadataSpans(line: string) {
  return [...line.matchAll(/<span(?: class="[^"]+")? style="display:none">\{.*?\}<\/span>/g)]
    .filter(match => {
      const offset = match.index!;
      // Ignore the span's own HTML delimiters when asking whether an outer
      // code/link/comment range protects it. Keep their original geometry.
      const surrounding = line.slice(0, offset) + ' '.repeat(match[0].length) + line.slice(offset + match[0].length);
      return !protectMarkdownSyntax(surrounding).contains(offset);
    });
}

/** Remove real recurrence metadata from the completed copy, keeping the
 * rule on the next instance so rechecking the original cannot spawn twice.
 */
export function stripRecurrenceFromLine(line: string): string {
  const fields = findInlineFieldSpans(line).filter(field => field.canonicalKey === 'repeat');
  const bodyOffset = parseTaskLine(line)?.bodyOffset ?? 0;
  for (const field of fields.reverse()) {
    let from = field.from;
    while (from > bodyOffset && /[ \t]/.test(line[from - 1])) from--;
    line = line.slice(0, from) + line.slice(field.to);
  }
  for (const span of legacyMetadataSpans(line).reverse()) {
    const replacement = span[0].replace(/"recurrence":"(?:[^"\\]|\\.)*"/, '"recurrence":null');
    line = line.slice(0, span.index!) + replacement + line.slice(span.index! + span[0].length);
  }
  return line;
}

interface RecurringTaskSource {
  blockId: string | null;
  legacyId: string;
  snapshot: string | null;
}

/** Resolve identity before comparing content, so a duplicate persisted ID
 * cannot become unambiguous merely because one copy has changed its text.
 */
function resolveRecurringTaskSpan(
  lines: string[], source: RecurringTaskSource, expectedSource?: string
): [number, number] | null {
  const context = markdownSourceContext(lines);
  const candidates = [...context.taskLines];
  const blockAt = (start: number): [number, number] =>
    [start, start + 1 + countTaskDescriptionLines(lines, start)];
  const textAt = (start: number) => {
    const [from, to] = blockAt(start);
    return lines.slice(from, to).join('\n');
  };
  const matches = candidates.filter(index => source.blockId
    ? hasTaskIdentity(lines[index], source.blockId)
    : source.legacyId
      ? hasTaskIdentity(lines[index], source.legacyId)
      : source.snapshot !== null && textAt(index) === source.snapshot);
  if (matches.length !== 1) return null;
  const start = matches[0];
  const span = blockAt(start);
  for (let index = span[0]; index < span[1]; index++) {
    if (context.unsafeRewriteLines.has(index)) return null;
  }
  const current = textAt(start);
  if ((source.snapshot !== null && current !== source.snapshot) ||
      (expectedSource !== undefined && current !== expectedSource)) return null;
  return span;
}

/**
 * Complete a recurring task directly in a file (used by the non-interactive
 * query-block card, which edits lines instead of going through a sync
 * manager): the current line is marked done in place (keeping the checked
 * task where the user clicked it, minus its recurrence rule) and the next
 * instance is inserted after its complete description. Returns false only
 * when the rule cannot advance. Lost/changed/ambiguous source throws because
 * a caller's plain-toggle fallback would otherwise write to a stale row.
 */
export async function completeRecurringTaskInFile(
  plugin: TaskCardPlugin,
  task: ObsidianTask,
  filePath: string,
  _lineStart: number
): Promise<boolean> {
  if (!parseRecurrenceRule(task.recurrence)) return false;
  const lines = await plugin.fileOperator.getFileLines(filePath);
  if (!lines) throw new FileWriteConflict('The recurring task file no longer exists.');
  const snapshot = typeof task.metadata?.sourceMarkdown === 'string'
    ? task.metadata.sourceMarkdown : null;
  const source: RecurringTaskSource = {
    blockId: isV2TaskId(task.id) ? task.id : task.metadata?.sourceBlockId ||
      (snapshot === null ? null : extractBlockId(snapshot.split('\n')[0]).id),
    legacyId: snapshot === null || hasTaskIdentity(snapshot.split('\n')[0], task.id) ? task.id : '',
    snapshot
  };
  const span = resolveRecurringTaskSpan(lines, source);
  if (!span) throw new FileWriteConflict('The recurring task source changed or could not be located uniquely.');
  const original = lines.slice(span[0], span[1]);
  const expectedSource = original.join('\n');
  const line = original[0];
  const prefix = parseTaskLine(line);
  if (!prefix) throw new FileWriteConflict('The recurring task source is no longer a task.');
  const nextTask = advanceRecurringTask(task);
  if (!nextTask) return false;
  const completedLine = stripRecurrenceFromLine(line.slice(0, prefix.statusOffset) + 'x' + line.slice(prefix.statusOffset + 1));
  const uncheckedPrefix = prefix.prefix.slice(0, prefix.statusOffset) + ' ' + prefix.prefix.slice(prefix.statusOffset + 1);
  nextTask.metadata = {
    ...nextTask.metadata,
    sourceTaskPrefix: uncheckedPrefix,
    sourceTaskStatus: ' ',
    sourceTaskCompleted: false
  };
  const formattedNext = plugin.taskFormatter.taskToLine(nextTask);
  const nextPrefix = parseTaskLine(formattedNext);
  if (!nextPrefix) throw new Error('The next recurring instance could not be formatted as a task.');
  const nextLine = uncheckedPrefix + nextPrefix.body;
  const description = original.slice(1).join('\n');
  const completedMarkdown = [completedLine, ...original.slice(1)].join('\n');
  const nextMarkdown = description
    ? nextLine + '\n' + resetDescriptionCheckboxes(description, line) : nextLine;
  await plugin.fileOperator.updateFile(
    filePath,
    `${completedMarkdown}\n${nextMarkdown}`,
    span[0],
    span[1],
    undefined,
    {
      source: expectedSource,
      resolveSpan: latest => resolveRecurringTaskSpan(latest, source, expectedSource)
    }
  );
  return true;
}
