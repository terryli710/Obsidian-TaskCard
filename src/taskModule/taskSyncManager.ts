import { MarkdownSectionInformation } from "obsidian";
import { ObsidianTask } from "./task";
import { FileOperator } from "../renderer/fileOperator";
import { TaskParser } from './taskParser';


export interface ObsidianTaskSyncProps {
    obsidianTask: ObsidianTask;
    markdownTask: string | null;
    taskItemEl: HTMLElement | null;
    taskMetadata: {
        sourcePath: string,
        mdSectionInfo: MarkdownSectionInformation | null,
        lineStartInSection: number | null,
        lineEndsInSection: number | null,
        }
    }

export class ObsidianTaskSyncManager implements ObsidianTaskSyncProps {
    obsidianTask: ObsidianTask;
    markdownTask: string | null;
    taskItemEl: HTMLElement | null;
    taskMetadata: {
        sourcePath: string,
        mdSectionInfo: MarkdownSectionInformation | null,
        lineStartInSection: number | null,
        lineEndsInSection: number | null,
    };
    fileOperator: FileOperator;
    taskParser: TaskParser;

    constructor(fileOperator: FileOperator, taskParser: TaskParser, props?: Partial<ObsidianTaskSyncProps>) {
        this.markdownTask = props?.markdownTask || null;
        this.obsidianTask = props?.obsidianTask || new ObsidianTask();
        this.taskMetadata = props?.taskMetadata || { sourcePath: null, mdSectionInfo: null, lineStartInSection: null, lineEndsInSection: null };
        this.fileOperator = fileOperator;
        this.taskParser = taskParser;
    }

    async getMarkdownTaskFromFile(): Promise<string> {
        // use the taskMetadata to get the file content for the task
        const docLineStart = this.taskMetadata.lineStartInSection + this.taskMetadata.mdSectionInfo.lineStart;
        const docLineEnd = this.taskMetadata.lineEndsInSection + this.taskMetadata.mdSectionInfo.lineStart;
        const markdownTask = await this.fileOperator.getMarkdownBetweenLines(this.taskMetadata.sourcePath, docLineStart, docLineEnd);
        return markdownTask
    }

    async updateTaskToFile(markdownTask: string): Promise<void> {
        const docLineStart = this.taskMetadata.lineStartInSection + this.taskMetadata.mdSectionInfo.lineStart;
        const docLineEnd = this.taskMetadata.lineEndsInSection + this.taskMetadata.mdSectionInfo.lineStart;
        await this.fileOperator.updateFile(this.taskMetadata.sourcePath, markdownTask, docLineStart, docLineEnd);
    }

    updateObsidianTaskAttribute(key: string, value: any): void {
        this.obsidianTask[key] = value;

    }

}