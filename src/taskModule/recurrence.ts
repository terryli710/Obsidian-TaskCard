import { RRule } from 'rrule';
import moment from 'moment';
import { ObsidianTask, ScheduleDate } from './task';
import { mintTaskId } from './fieldSyntax';
import type TaskCardPlugin from '..';
import { logger } from '../utils/log';

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
  } catch (e) {
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
export function resetDescriptionCheckboxes(description: string): string {
  return description.replace(/^(\s*- )\[[xX]\]/gm, '$1[ ]');
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

/**
 * Remove the recurrence rule from a formatted task line — either syntax:
 * the v2 `[repeat:: ...]` inline field or the legacy v1 hidden-span JSON
 * (`"recurrence":"..."`). Used on the completed copy of a recurring task so
 * that unchecking and re-checking it cannot spawn further instances; the rule
 * lives on in the freshly inserted next instance.
 */
export function stripRecurrenceFromLine(line: string): string {
  return line
    .replace(/\s*\[repeat::[^\]]*\]/, '')
    .replace(/"recurrence":"(?:[^"\\]|\\.)*"/, '"recurrence":null');
}

/**
 * Complete a recurring task directly in a file (used by the non-interactive
 * query-block card, which edits lines instead of going through a sync
 * manager): the current line is marked done in place (keeping the checked
 * task where the user clicked it, minus its recurrence rule) and the next
 * instance is inserted on the line below. Returns false when the task could
 * not be advanced (the caller should fall back to a plain completion toggle).
 */
export async function completeRecurringTaskInFile(
  plugin: TaskCardPlugin,
  task: ObsidianTask,
  filePath: string,
  lineStart: number
): Promise<boolean> {
  const nextTask = advanceRecurringTask(task);
  if (!nextTask) return false;
  const line = await plugin.fileOperator.getLineFromFile(
    filePath,
    lineStart + 1
  );
  if (!line) return false;
  const completedLine = stripRecurrenceFromLine(
    line.replace(/- \[[^\]]\]/, '- [x]')
  );
  const nextMarkdown = plugin.taskFormatter.taskToMarkdown(nextTask);
  await plugin.fileOperator.updateFile(
    filePath,
    `${completedLine}\n${nextMarkdown}`,
    lineStart,
    lineStart + 1
  );
  return true;
}
