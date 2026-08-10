import { SettingStore } from '../settings';
import { ObsidianTask } from './task';
import {
  formatDurationValue,
  formatInlineField,
  formatScheduleValue,
  isV2TaskId,
  mintTaskId,
  priorityNumberToWord
} from './fieldSyntax';

/**
 * Writes the TaskCard v2 on-disk format (docs/format-spec.md):
 *
 *   - [ ] content #labels #TaskCard [priority:: high] [due:: 2026-07-10] ... ^tc-xxxxxx
 *       description lines, 4-space indented
 *
 * Nothing hidden is ever written; machine bookkeeping (sync mappings,
 * display state) lives in the plugin data store keyed by the block id.
 */
export class TaskFormatter {
  indicatorTag: string;
  writeCompletionDate: boolean;

  constructor(settingsStore: typeof SettingStore) {
    // Subscribe to the settings store
    settingsStore.subscribe((settings) => {
      this.indicatorTag = settings.parsingSettings.indicatorTag;
      this.writeCompletionDate =
        settings.parsingSettings.writeCompletionDate !== false;
    });
  }

  /**
   * Give the task a durable v2 identity if it doesn't have one yet.
   * Mutates the task so callers persist the same id that lands on disk.
   */
  ensureTaskId(task: ObsidianTask): string {
    if (!isV2TaskId(task.id)) {
      task.id = mintTaskId();
    }
    return task.id;
  }

  /**
   * The single task line (no description block).
   *
   * Pass `{ mintId: false }` to serialize a preview line without minting a
   * durable v2 id (used by the quick-add modal's live preview): an already-
   * valid v2 id is still shown, but a fresh one is never handed out until
   * the caller actually intends to write the task.
   */
  taskToLine(task: ObsidianTask, options: { mintId?: boolean } = {}): string {
    const mintId = options.mintId !== false;
    if (mintId) {
      this.ensureTaskId(task);
    }

    const taskPrefix = `- [${task.completed ? 'x' : ' '}]`;
    const labelMarkdown = task.labels.join(' ');
    let line = `${taskPrefix} ${task.content} ${labelMarkdown} #${this.indicatorTag}`;
    line = line.replace(/\s+/g, ' ').trimEnd();

    const fields: string[] = [];

    const priorityWord = priorityNumberToWord(task.priority ?? 4);
    if (priorityWord) fields.push(formatInlineField('priority', priorityWord));

    if (task.hasDue()) {
      fields.push(formatInlineField('due', formatScheduleValue(task.due)));
    }
    if (task.hasSchedule()) {
      fields.push(
        formatInlineField('scheduled', formatScheduleValue(task.schedule))
      );
    }
    if (task.hasDuration()) {
      const durationValue = formatDurationValue(task.duration);
      if (durationValue) fields.push(formatInlineField('duration', durationValue));
    }
    if (task.hasRecurrence()) {
      fields.push(formatInlineField('repeat', task.recurrence.trim()));
    }
    if (task.hasProject()) {
      fields.push(formatInlineField('project', task.project.name));
    }
    if (this.writeCompletionDate && task.completed && task.completionDate) {
      fields.push(formatInlineField('completion', task.completionDate));
    }

    for (const foreignField of task.metadata?.foreignFields ?? []) {
      fields.push(foreignField);
    }

    if (fields.length > 0) {
      line += ' ' + fields.join(' ');
    }

    const idSuffix = isV2TaskId(task.id) ? ` ^${task.id}` : '';
    return `${line}${idSuffix}`;
  }

  taskToMarkdown(task: ObsidianTask): string {
    let taskMarkdown = this.taskToLine(task);

    // Add description
    if (task.description.length > 0) {
      // for each line, add 4 spaces
      taskMarkdown += `\n    ${task.description.replace(/\n/g, '\n    ')}`;
    }

    return taskMarkdown;
  }
}
