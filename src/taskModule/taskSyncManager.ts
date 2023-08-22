import { MarkdownSectionInformation } from 'obsidian';
import { ObsidianTask } from './task';
import TaskCardPlugin from '..';
import { logger } from '../utils/log';

type TaskCardStatus = {
  descriptionStatus: 'editing' | 'done';
  projectStatus: 'selecting' | 'done';
  dueStatus: 'editing' | 'done';
};

export interface ObsidianTaskSyncProps {
  obsidianTask: ObsidianTask; // typescript class for the ObsidianTask
  taskCardStatus: TaskCardStatus;
  taskItemEl: HTMLElement | null; // the HTML element to represent the task
  taskMetadata: {
    // metadata about the task, position in a file.
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
      dueStatus: 'done'
    };
    this.taskItemEl = props?.taskItemEl || null;
    this.taskMetadata = props?.taskMetadata || {
      sourcePath: null,
      mdSectionInfo: null,
      lineStartInSection: null,
      lineEndsInSection: null
    };
    this.plugin = plugin;
  }

  async getMarkdownTaskFromFile(): Promise<string> {
    // use the taskMetadata to get the file content for the task
    const docLineStart =
      this.taskMetadata.lineStartInSection +
      this.taskMetadata.mdSectionInfo.lineStart;
    const docLineEnd =
      this.taskMetadata.lineEndsInSection +
      this.taskMetadata.mdSectionInfo.lineStart;
    const markdownTask = await this.plugin.fileOperator.getMarkdownBetweenLines(
      this.taskMetadata.sourcePath,
      docLineStart,
      docLineEnd
    );
    return markdownTask;
  }

  async updateTaskToFile(markdownTask: string): Promise<void> {
    const docLineStart =
      this.taskMetadata.lineStartInSection +
      this.taskMetadata.mdSectionInfo.lineStart;
    const docLineEnd =
      this.taskMetadata.lineEndsInSection +
      this.taskMetadata.mdSectionInfo.lineStart;
    // logger.debug(`taskSyncManager - updateTaskToFile: docLineStart: ${docLineStart}, docLineEnd: ${docLineEnd},
    // linStartInSection: ${this.taskMetadata.lineStartInSection}, lineEndsInSection: ${this.taskMetadata.lineEndsInSection},
    // section line start: ${this.taskMetadata.mdSectionInfo.lineStart}, section line end: ${this.taskMetadata.mdSectionInfo.lineEnd}`);
    await this.plugin.fileOperator.updateFile(
      this.taskMetadata.sourcePath,
      markdownTask,
      docLineStart,
      docLineEnd
    );
  }

  updateObsidianTaskAttribute(key: string, value: any): void {
    this.obsidianTask[key] = value;
    logger.debug(`successfully set ${key} to ${value}`);
    const markdownTask = this.plugin.taskFormatter.taskToMarkdownOneLine(
      this.obsidianTask
    );
    // logger.debug(`markdownTask: ${markdownTask}`);
    this.updateTaskToFile(markdownTask);
  }

  isValidStatus(key: keyof TaskCardStatus, status: string): boolean {
    const allowedStatuses = {
      descriptionStatus: ['editing', 'done'],
      projectStatus: ['selecting', 'done'],
      dueStatus: ['editing', 'done']
    };
    return allowedStatuses[key].includes(status);
  }

  setTaskCardStatus(key: keyof TaskCardStatus, status: string): void {
    // check if the status is valid
    if (!this.isValidStatus(key, status)) return;
    this.taskCardStatus[key] = status as any;
    logger.debug(`successfully set ${key} to ${status}`);
  }

  getTaskCardStatus(key: keyof TaskCardStatus): string {
    return this.taskCardStatus[key];
  }

  async deleteTask(): Promise<void> {
    const docLineStart =
      this.taskMetadata.lineStartInSection +
      this.taskMetadata.mdSectionInfo.lineStart;
    const docLineEnd =
      this.taskMetadata.lineEndsInSection +
      this.taskMetadata.mdSectionInfo.lineStart;
    await this.plugin.fileOperator.updateFile(
      this.taskMetadata.sourcePath,
      '',
      docLineStart,
      docLineEnd
    );
  }
}
