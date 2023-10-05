import { MarkdownPostProcessorContext, MarkdownSectionInformation } from 'obsidian';
import { ObsidianTask } from './task';
import TaskCardPlugin from '..';
import { logger } from '../utils/log';

type TaskCardStatus = {
  descriptionStatus: 'editing' | 'done';
  projectStatus: 'selecting' | 'done';
  dueStatus: 'editing' | 'done';
  durationStatus: 'editing' | 'done';
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
      dueStatus: 'done',
      durationStatus: 'done',
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
    this.taskMetadata.mdSectionInfo = this.taskMetadata.ctx.getSectionInfo(this.taskMetadata.sectionEl);
  }

  getDocLineStartEnd(): [number, number] {
    this.refreshMetadata();
    return [
      this.taskMetadata.lineStartInSection + this.taskMetadata.mdSectionInfo.lineStart, 
      this.taskMetadata.lineEndsInSection + this.taskMetadata.mdSectionInfo.lineStart
    ];
  }

  async getMarkdownTaskFromFile(): Promise<string> {
    // use the taskMetadata to get the file content for the task
    const [docLineStart, docLineEnd] = this.getDocLineStartEnd();
    const markdownTask = await this.plugin.fileOperator.getMarkdownBetweenLines(
      this.taskMetadata.sourcePath,
      docLineStart,
      docLineEnd
    );
    return markdownTask;
  }

  async updateMarkdownTaskToFile(markdownTask: string): Promise<void> {
    const [docLineStart, docLineEnd] = this.getDocLineStartEnd();
    await this.plugin.fileOperator.updateFile(
      this.taskMetadata.sourcePath,
      markdownTask,
      docLineStart,
      docLineEnd
    );
  }

  updateObsidianTaskAttribute(key: string, value: any): void {
    this.obsidianTask[key] = value;
    logger.info(`successfully set ${key} to ${value}`);
    this.updateTaskToFile();
  }

  updateObsidianTaskDisplayParams(key: string, value: any): void {
    this.obsidianTask.setTaskDisplayParams(key, value);
    this.updateTaskToFile();
  }

  clearObsidianTaskDisplayParams(): void {
    this.obsidianTask.clearTaskDisplayParams();
    this.updateTaskToFile();
  }

  updateTaskToFile(): void {
    const markdownTask = this.plugin.taskFormatter.taskToMarkdown(
      this.obsidianTask
    );
    this.updateMarkdownTaskToFile(markdownTask);
  }

  isValidStatus(key: keyof TaskCardStatus, status: string): boolean {
    const allowedStatuses = {
      descriptionStatus: ['editing', 'done'],
      projectStatus: ['selecting', 'done'],
      dueStatus: ['editing', 'done'],
      durationStatus: ['editing', 'done']
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
    const [docLineStart, docLineEnd] = this.getDocLineStartEnd();
    await this.plugin.fileOperator.updateFile(
      this.taskMetadata.sourcePath,
      '',
      docLineStart,
      docLineEnd
    );
  }
}
