import { MarkdownSectionInformation } from "obsidian";
import { ObsidianTask } from "./task";
import TaskCardPlugin from "..";


export interface ObsidianTaskSyncProps {
    obsidianTask: ObsidianTask; // typescript class for the ObsidianTask
    // markdownTask: string | null;
    taskItemEl: HTMLElement | null; // the HTML element to represent the task
    taskMetadata: { // metadata about the task, position in a file.
        sourcePath: string,
        mdSectionInfo: MarkdownSectionInformation | null,
        lineStartInSection: number | null,
        lineEndsInSection: number | null,
        }
    }

export class ObsidianTaskSyncManager implements ObsidianTaskSyncProps {
    public obsidianTask: ObsidianTask;
    // markdownTask: string | null;
    public taskItemEl: HTMLElement | null;
    public taskMetadata: {
        sourcePath: string,
        mdSectionInfo: MarkdownSectionInformation | null,
        lineStartInSection: number | null,
        lineEndsInSection: number | null,
    };
    public plugin: TaskCardPlugin;

    constructor(plugin: TaskCardPlugin, props?: Partial<ObsidianTaskSyncProps>) {
        // this.markdownTask = props?.markdownTask || null;
        this.obsidianTask = props?.obsidianTask || new ObsidianTask();
        this.taskItemEl = props?.taskItemEl || null;
        this.taskMetadata = props?.taskMetadata || { sourcePath: null, mdSectionInfo: null, lineStartInSection: null, lineEndsInSection: null };
        this.plugin = plugin;
    }

    async getMarkdownTaskFromFile(): Promise<string> {
        // use the taskMetadata to get the file content for the task
        const docLineStart = this.taskMetadata.lineStartInSection + this.taskMetadata.mdSectionInfo.lineStart;
        const docLineEnd = this.taskMetadata.lineEndsInSection + this.taskMetadata.mdSectionInfo.lineStart;
        const markdownTask = await this.plugin.fileOperator.getMarkdownBetweenLines(this.taskMetadata.sourcePath, docLineStart, docLineEnd);
        return markdownTask
    }

    async updateTaskToFile(markdownTask: string): Promise<void> {
        const docLineStart = this.taskMetadata.lineStartInSection + this.taskMetadata.mdSectionInfo.lineStart;
        const docLineEnd = this.taskMetadata.lineEndsInSection + this.taskMetadata.mdSectionInfo.lineStart;
        await this.plugin.fileOperator.updateFile(this.taskMetadata.sourcePath, markdownTask, docLineStart, docLineEnd);
    }

    updateObsidianTaskAttribute(key: string, value: any): void {
        this.obsidianTask[key] = value;
        const markdownTask = this.plugin.taskFormatter.taskToMarkdownOneLine(this.obsidianTask);
        this.updateTaskToFile(markdownTask);
    }

}