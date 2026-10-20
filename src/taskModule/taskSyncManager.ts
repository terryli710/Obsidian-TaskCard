import { MarkdownPostProcessorContext, MarkdownSectionInformation, Notice } from 'obsidian';
import { moment } from '../utils/obsidianMoment';
import { ObsidianTask } from './task';
import { advanceRecurringTask } from './recurrence';
import { hasTaskIdentity } from './fieldSyntax';
import TaskCardPlugin from '..';
import { logger } from '../utils/log';
import { FileWriteConflict, FileSourceExpectation } from '../renderer/fileOperator';
import { countTaskDescriptionLines, parseTaskLine } from '../utils/taskLine';
import { markdownSourceContext } from '../utils/markdownSourceContext';


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

// Keep write spans aligned with the parser, including quoted continuations.
export function countFormattedDescriptionLines(
  fileLines: string[], taskLineIndex: number
): number {
  return countTaskDescriptionLines(fileLines, taskLineIndex);
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
  private sourceMarkdown: string | null;
  private sourceTaskId: string;
  private attributeWrites: Promise<void> = Promise.resolve();

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
    this.sourceTaskId = this.obsidianTask.id;
    const info = this.taskMetadata.mdSectionInfo;
    const start = this.taskMetadata.lineStartInSection;
    const end = this.taskMetadata.lineEndsInSection;
    this.sourceMarkdown = this.obsidianTask.metadata?.sourceMarkdown ?? (
      info && start != null && end != null
        ? info.text.split('\n').slice(info.lineStart + start, info.lineStart + end).join('\n')
        : null
    );
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

  // A durable ID must be unique even when it still occupies the cached line.
  // An ID-less first save needs an exact render snapshot at the cached span.
  private resolveSpan(
    lines: string[], cached: [number, number] | null, id: string,
    source: string | null
  ): [number, number] | null {
    const context = markdownSourceContext(lines);
    const safeSpan = (start: number, end: number) => context.taskLines.has(start) &&
      !Array.from({ length: end - start }, (_, offset) => start + offset)
        .some(index => context.unsafeRewriteLines.has(index));
    const sourceLines = source?.split('\n');
    const firstLine = sourceLines?.[0];
    const sameDescriptionExtent = (start: number) => lines[start] !== undefined &&
      (sourceLines == null || countFormattedDescriptionLines(lines, start) ===
        countFormattedDescriptionLines(sourceLines, 0));
    const matchesId = (line: string) => hasTaskIdentity(line, id);
    const sourceHasId = firstLine != null && matchesId(firstLine);
    if (source !== null && !sourceHasId) {
      if (!cached || !parseTaskLine(firstLine)) return null;
      const end = cached[0] + source.split('\n').length;
      return safeSpan(cached[0], end) && sameDescriptionExtent(cached[0]) && lines.slice(cached[0], end).join('\n') === source
        ? [cached[0], end] : null;
    }
    if (!id) return null;
    const matches: number[] = [];
    lines.forEach((line, index) => {
      if (context.taskLines.has(index) && matchesId(line)) matches.push(index);
    });
    if (matches.length !== 1) return null;
    const start = matches[0];
    if (!parseTaskLine(lines[start]) || !sameDescriptionExtent(start)) return null;
    const length = source !== null ? source.split('\n').length
      : cached ? cached[1] - cached[0] : 1 + countFormattedDescriptionLines(lines, start);
    return safeSpan(start, start + length) ? [start, start + length] : null;
  }

  async resolveDocLineStartEnd(): Promise<[number, number] | null> {
    const cached = this.getDocLineStartEnd();
    const lines = await this.plugin.fileOperator.getFileLines(this.taskMetadata.sourcePath);
    return lines ? this.resolveSpan(lines, cached, this.sourceTaskId, this.sourceMarkdown) : null;
  }

  private async prepareWrite(): Promise<{
    span: [number, number]; expected: FileSourceExpectation;
  } | null> {
    const cached = this.getDocLineStartEnd();
    const id = this.sourceTaskId;
    const lines = await this.plugin.fileOperator.getFileLines(this.taskMetadata.sourcePath);
    const span = lines && this.resolveSpan(lines, cached, id, this.sourceMarkdown);
    if (!span) {
      this.announceLostTask();
      return null;
    }
    const source = this.sourceMarkdown ?? lines.slice(span[0], span[1]).join('\n');
    if (lines.slice(span[0], span[1]).join('\n') !== source) {
      this.announceLostTask();
      return null;
    }
    return { span, expected: {
      source,
      resolveSpan: latest => this.resolveSpan(latest, cached, id, source)
    } };
  }

  private async writePrepared(
    markdown: string,
    target: { span: [number, number]; expected: FileSourceExpectation },
    savedTaskMarkdown = markdown
  ): Promise<boolean> {
    const savedDescription = this.obsidianTask.description;
    const commitDisplayState = this.plugin.taskCardRenderManager?.prepareTaskWrite(this, markdown);
    try {
      await this.plugin.fileOperator.updateFile(
        this.taskMetadata.sourcePath, markdown, target.span[0], target.span[1],
        undefined, target.expected
      );
    } catch (error) {
      if (!(error instanceof FileWriteConflict)) throw error;
      this.announceLostTask();
      return false;
    }
    this.sourceMarkdown = savedTaskMarkdown;
    this.sourceTaskId = this.obsidianTask.id;
    const savedLines = savedTaskMarkdown.split('\n');
    const prefix = parseTaskLine(savedLines[0]);
    this.obsidianTask.metadata = {
      ...this.obsidianTask.metadata,
      sourceMarkdown: savedTaskMarkdown,
      sourceTaskPrefix: prefix?.prefix,
      sourceTaskStatus: prefix?.status,
      sourceTaskCompleted: prefix ? /^[xX]$/.test(prefix.status) : undefined,
      sourceDescription: savedDescription,
      sourceDescriptionMarkdown: savedLines.slice(1).join('\n')
    };
    commitDisplayState?.();
    return true;
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
    const target = await this.prepareWrite();
    if (target) await this.writePrepared(markdownTask, target);
  }

  updateObsidianTaskAttribute(key: string, value: any): Promise<void> {
    const operation = this.attributeWrites.then(() => this.saveAttribute(key, value));
    // Keep later user actions usable even when a disk or sync operation fails.
    this.attributeWrites = operation.catch(() => undefined);
    return operation;
  }

  private async syncSavedTask(original: ObsidianTask): Promise<void> {
    const syncMetadata = await this.plugin.externalAPIManager?.updateTask(
      this.obsidianTask.getCopy(), original
    );
    if (syncMetadata) this.obsidianTask.metadata.syncMappings = syncMetadata;
    await this.plugin.storeSyncMappings(this.obsidianTask.id, syncMetadata);
  }

  private async saveAttribute(key: string, value: any): Promise<void> {
    if (key === 'completed' && value === true && this.obsidianTask.hasRecurrence()) {
      const handled = await this.completeRecurringTask();
      if (handled) return;
    }
    const original = this.obsidianTask.getCopy();
    this.obsidianTask[key] = value;
    if (key === 'completed') {
      this.obsidianTask.completionDate = value ? moment().format('YYYY-MM-DD') : null;
    }
    try {
      if (!await this.updateTaskToFile()) {
        Object.assign(this.obsidianTask, original);
        return;
      }
    } catch (error) {
      Object.assign(this.obsidianTask, original);
      this.announceLostTask();
      return;
    }
    await this.syncSavedTask(original);
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
    const target = await this.prepareWrite();
    if (!target) return true;
    const indent = target.expected.source.match(/^[ \t]*/)[0];
    const origTask = this.obsidianTask.getCopy();
    this.obsidianTask.completed = true;
    this.obsidianTask.recurrence = null;
    this.obsidianTask.completionDate = moment().format('YYYY-MM-DD');
    try {
      const completedMarkdown = this.formatTaskWithIndent(this.obsidianTask, indent);
      const nextMarkdown = this.formatTaskWithIndent(nextTask, indent);
      if (!await this.writePrepared(
        `${completedMarkdown}\n${nextMarkdown}`, target, completedMarkdown
      )) {
        Object.assign(this.obsidianTask, origTask);
        return true;
      }
    } catch (error) {
      Object.assign(this.obsidianTask, origTask);
      this.announceLostTask();
      return true;
    }
    await this.syncSavedTask(origTask);
    return true;
  }

  // v2: per-task display state is ephemeral UI state, never written to notes
  updateObsidianTaskDisplayParams(key: string, value: any): void {
    this.obsidianTask.setTaskDisplayParams(key, value);
    this.plugin.taskCardRenderManager?.rememberTaskDisplayParams(this);
  }

  clearObsidianTaskDisplayParams(): void {
    this.obsidianTask.clearTaskDisplayParams();
    this.plugin.taskCardRenderManager?.rememberTaskDisplayParams(this);
  }

  private formatTaskWithIndent(task: ObsidianTask, indent: string): string {
    const markdown = this.plugin.taskFormatter.taskToMarkdown(task);
    return task.metadata?.sourceTaskPrefix != null ? markdown
      : markdown.split('\n').map((line) => indent + line).join('\n');
  }

  async updateTaskToFile(): Promise<boolean> {
    const target = await this.prepareWrite();
    if (!target) return false;
    const markdownTask = this.formatTaskWithIndent(
      this.obsidianTask, target.expected.source.match(/^[ \t]*/)[0]
    );
    return await this.writePrepared(markdownTask, target);
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
    const target = await this.prepareWrite();
    if (!target || !await this.writePrepared('', target)) return;

    this.plugin.externalAPIManager?.deleteTask(this.obsidianTask);
    await this.plugin.removeSyncMappings(this.obsidianTask.id);
  }
}
