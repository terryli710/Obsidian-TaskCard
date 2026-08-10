import { MarkdownPostProcessorContext, MarkdownSectionInformation, Notice } from 'obsidian';
import { moment } from '../utils/obsidianMoment';
import { ObsidianTask } from './task';
import { advanceRecurringTask } from './recurrence';
import { taskIdToken } from './fieldSyntax';
import TaskCardPlugin from '..';
import { logger } from '../utils/log';


type TaskCardStatus = {
  descriptionStatus: 'editing' | 'done';
  projectStatus: 'selecting' | 'done';
  scheduleStatus: 'editing' | 'done';
  dueStatus: 'editing' | 'done';
  durationStatus: 'editing' | 'done';
  recurrenceStatus: 'editing' | 'done';
};

export interface ObsidianTaskSyncProps {
  obsidianTask: ObsidianTask; // typescript class for the ObsidianTask
  taskCardStatus: TaskCardStatus;
  taskItemEl: HTMLElement | null; // the HTML element to represent the task
  taskMetadata: {
    // metadata about the task, position in a file.
    sectionEl: HTMLElement;
    ctx: MarkdownPostProcessorContext;
    sourcePath: string;
    mdSectionInfo: MarkdownSectionInformation | null;
    lineStartInSection: number | null;
    lineEndsInSection: number | null;
  };
}

// Extent of a formatted task's description as written by TaskFormatter:
// consecutive lines indented deeper than the task line. Deliberately narrower
// than TaskParser.determineDescriptionLineNumber, which also counts unindented
// plain text (known-issues #2) — over-spanning here would splice user content.
export function countFormattedDescriptionLines(
  fileLines: string[],
  taskLineIndex: number
): number {
  const taskIndent = fileLines[taskLineIndex].match(/^\s*/)[0].length;
  let count = 0;
  for (let i = taskLineIndex + 1; i < fileLines.length; i++) {
    const line = fileLines[i];
    if (line.trim() === '') break;
    if (line.match(/^\s*/)[0].length <= taskIndent) break;
    count++;
  }
  return count;
}

export class ObsidianTaskSyncManager implements ObsidianTaskSyncProps {
  public obsidianTask: ObsidianTask;
  public taskCardStatus: TaskCardStatus;
  public taskItemEl: HTMLElement | null;
  public taskMetadata: {
    sectionEl: HTMLElement;
    ctx: MarkdownPostProcessorContext;
    sourcePath: string;
    mdSectionInfo: MarkdownSectionInformation | null;
    lineStartInSection: number | null;
    lineEndsInSection: number | null;
  };
  public plugin: TaskCardPlugin;

  constructor(plugin: TaskCardPlugin, props?: Partial<ObsidianTaskSyncProps>) {
    // this.markdownTask = props?.markdownTask || null;
    this.obsidianTask = props?.obsidianTask || new ObsidianTask();
    this.taskCardStatus = props?.taskCardStatus || {
      descriptionStatus: 'done',
      projectStatus: 'done',
      scheduleStatus: 'done',
      dueStatus: 'done',
      durationStatus: 'done',
      recurrenceStatus: 'done',
    };
    this.taskItemEl = props?.taskItemEl || null;
    this.taskMetadata = props?.taskMetadata || {
      sectionEl: null,
      ctx: null,
      sourcePath: null,
      mdSectionInfo: null,
      lineStartInSection: null,
      lineEndsInSection: null
    };
    this.plugin = plugin;
  }

  refreshMetadata(): void {
    const { ctx, sectionEl } = this.taskMetadata;
    // getSectionInfo legitimately returns null once the section element is
    // detached (an edit racing a re-render)
    this.taskMetadata.mdSectionInfo = ctx && sectionEl ? ctx.getSectionInfo(sectionEl) : null;
  }

  getDocLineStartEnd(): [number, number] | null {
    this.refreshMetadata();
    const info = this.taskMetadata.mdSectionInfo;
    if (
      !info ||
      this.taskMetadata.lineStartInSection === null ||
      this.taskMetadata.lineEndsInSection === null
    ) {
      return null;
    }
    return [
      this.taskMetadata.lineStartInSection + info.lineStart,
      this.taskMetadata.lineEndsInSection + info.lineStart
    ];
  }

  // Task identity is line/position based (known-issues #4), so the cached span
  // goes stale whenever lines shift between render and write. Only trust it
  // when the task's id token (v2 block id, or the legacy hidden-span id) is
  // still on the cached start line; otherwise search the file for the id and
  // shift the span to the task's current location. Falls back to the cached
  // span when the id cannot be located unambiguously.
  async resolveDocLineStartEnd(): Promise<[number, number] | null> {
    const cached = this.getDocLineStartEnd();
    const id = this.obsidianTask.id;
    if (!id) return cached;
    const fileLines = await this.plugin.fileOperator.getFileLines(
      this.taskMetadata.sourcePath
    );
    if (!fileLines) return cached;
    const idToken = taskIdToken(id);
    if (cached && fileLines[cached[0]]?.includes(idToken)) return cached;

    const matches: number[] = [];
    fileLines.forEach((line, index) => {
      if (line.includes(idToken)) matches.push(index);
    });
    if (matches.length !== 1) return cached;

    const start = matches[0];
    if (cached) {
      logger.info(
        `Task ${id} moved from line ${cached[0]} to ${start} in ${this.taskMetadata.sourcePath}; relocating write span.`
      );
      return [start, start + (cached[1] - cached[0])];
    }
    return [start, start + 1 + countFormattedDescriptionLines(fileLines, start)];
  }

  private announceLostTask(): void {
    logger.warn(
      `Could not locate task ${this.obsidianTask.id} in ${this.taskMetadata.sourcePath}; skipping file write to avoid corrupting the note.`
    );
    new Notice(
      'TaskCard: could not locate this task in the file, so the edit was not saved. Please re-open the note and try again.'
    );
  }

  async getMarkdownTaskFromFile(): Promise<string | null> {
    // use the taskMetadata to get the file content for the task
    const span = await this.resolveDocLineStartEnd();
    if (!span) {
      this.announceLostTask();
      return null;
    }
    const markdownTask = await this.plugin.fileOperator.getMarkdownBetweenLines(
      this.taskMetadata.sourcePath,
      span[0],
      span[1]
    );
    return markdownTask;
  }

  async updateMarkdownTaskToFile(markdownTask: string): Promise<void> {
    const span = await this.resolveDocLineStartEnd();
    if (!span) {
      this.announceLostTask();
      return;
    }
    await this.plugin.fileOperator.updateFile(
      this.taskMetadata.sourcePath,
      markdownTask,
      span[0],
      span[1]
    );
  }

  async updateObsidianTaskAttribute(key: string, value: any): Promise<void> {
    if (key === 'completed' && value === true && this.obsidianTask.hasRecurrence()) {
      const handled = await this.completeRecurringTask();
      if (handled) return;
      // fall through to a plain completion when the rule cannot be advanced
    }
    const origTask = this.obsidianTask.getCopy();
    this.obsidianTask[key] = value;
    if (key === 'completed') {
      this.obsidianTask.completionDate = value
        ? moment().format('YYYY-MM-DD')
        : null;
    }
    const newTask = this.obsidianTask.getCopy();
    logger.info(`successfully set ${key} to ${value}`);
    const syncMetadata = await this.plugin.externalAPIManager?.updateTask(newTask, origTask);
    if (syncMetadata) this.obsidianTask.metadata.syncMappings = syncMetadata;
    await this.updateTaskToFile();
    // the write may have minted the task's durable id — store mappings under it
    await this.plugin.storeSyncMappings(this.obsidianTask.id, syncMetadata);
  }

  // Completing a recurring task checks the clicked line in place and inserts
  // the next instance (dates advanced by the rule) on the line below, so the
  // task the user acted on visibly completes where it was — writing the new
  // unchecked instance onto the clicked line reads as "completion didn't take,
  // and a duplicate appeared". The completed copy also loses its recurrence
  // rule (the rule lives on in the new instance); otherwise unchecking and
  // re-checking the done copy would spawn another instance every time.
  private async completeRecurringTask(): Promise<boolean> {
    const nextTask = advanceRecurringTask(this.obsidianTask);
    if (!nextTask) return false;
    // resolve the span before formatting: formatting may mint a new id, and
    // the old id is what locates the task's current line
    const span = await this.resolveDocLineStartEnd();
    if (!span) {
      this.announceLostTask();
      return true; // handled (nothing safe to write)
    }
    const origTask = this.obsidianTask.getCopy();
    this.obsidianTask.completed = true;
    this.obsidianTask.recurrence = null;
    this.obsidianTask.completionDate = moment().format('YYYY-MM-DD');
    const syncMetadata = await this.plugin.externalAPIManager?.updateTask(
      this.obsidianTask.getCopy(),
      origTask
    );
    if (syncMetadata) this.obsidianTask.metadata.syncMappings = syncMetadata;
    const completedMarkdown = this.plugin.taskFormatter.taskToMarkdown(this.obsidianTask);
    const nextMarkdown = this.plugin.taskFormatter.taskToMarkdown(nextTask);
    await this.plugin.fileOperator.updateFile(
      this.taskMetadata.sourcePath,
      `${completedMarkdown}\n${nextMarkdown}`,
      span[0],
      span[1]
    );
    await this.plugin.storeSyncMappings(this.obsidianTask.id, syncMetadata);
    return true;
  }

  // v2: per-task display state is ephemeral UI state, never written to notes
  updateObsidianTaskDisplayParams(key: string, value: any): void {
    this.obsidianTask.setTaskDisplayParams(key, value);
  }

  clearObsidianTaskDisplayParams(): void {
    this.obsidianTask.clearTaskDisplayParams();
  }

  async updateTaskToFile(): Promise<void> {
    // resolve the span before formatting: formatting may mint a new id, and
    // the old id is what locates the task's current line
    const span = await this.resolveDocLineStartEnd();
    if (!span) {
      this.announceLostTask();
      return;
    }
    const markdownTask = this.plugin.taskFormatter.taskToMarkdown(
      this.obsidianTask
    );
    await this.plugin.fileOperator.updateFile(
      this.taskMetadata.sourcePath,
      markdownTask,
      span[0],
      span[1]
    );
  }

  isValidStatus(key: keyof TaskCardStatus, status: string): boolean {
    const allowedStatuses = {
      descriptionStatus: ['editing', 'done'],
      projectStatus: ['selecting', 'done'],
      scheduleStatus: ['editing', 'done'],
      dueStatus: ['editing', 'done'],
      durationStatus: ['editing', 'done'],
      recurrenceStatus: ['editing', 'done']
    };
    return allowedStatuses[key].includes(status);
  }

  setTaskCardStatus(key: keyof TaskCardStatus, status: string): void {
    // check if the status is valid
    if (!this.isValidStatus(key, status)) return;
    this.taskCardStatus[key] = status as any;
  }

  getTaskCardStatus(key: keyof TaskCardStatus): string {
    return this.taskCardStatus[key];
  }

  async deleteTask(): Promise<void> {
    const span = await this.resolveDocLineStartEnd();
    if (!span) {
      this.announceLostTask();
      return;
    }
    await this.plugin.fileOperator.updateFile(
      this.taskMetadata.sourcePath,
      '',
      span[0],
      span[1]
    );

    this.plugin.externalAPIManager?.deleteTask(this.obsidianTask);
    await this.plugin.removeSyncMappings(this.obsidianTask.id);
  }
}
