import { App, TAbstractFile, TFile } from "obsidian";
import TaskCardPlugin from "..";
import { TaskItemData } from ".";


export class FileOperator {
    app: App;
    plugin: TaskCardPlugin;

    constructor(plugin: TaskCardPlugin) {
        this.plugin = plugin;
    }

    async getFileContent(filePath: string): Promise<string> {
        const file: TAbstractFile = this.app.vault.getAbstractFileByPath(filePath);
        const content = await this.app.vault.read(file as TFile);
        return content
    }

    async getFileLines(filePath: string): Promise<string[]> {
        const content = await this.getFileContent(filePath);
        return content.split('\n');
    }

    async getObsidianTaskLineNumber(taskItemData: TaskItemData): Promise<[number, number]> {
        const lineStart = taskItemData.mdSectionInfo.lineStart;
        const lineEnd = taskItemData.mdSectionInfo.lineStart + taskItemData.lineNumberEndsInSection? taskItemData.lineNumberEndsInSection : taskItemData.lineNumberInSection;
        return [lineStart, lineEnd];
    }

    async getObsidianTask(taskItemData: TaskItemData, filePath: string): Promise<string> {
        const fileLines = await this.getFileLines(filePath);
        const [lineStart, lineEnd] = await this.getObsidianTaskLineNumber(taskItemData);
        return fileLines.slice(lineStart, lineEnd).join('\n');
    }

    async updateFile(filePath: string, newContent: string, lineStart: number, lineEnd: number): Promise<void> {
        const file = await this.app.vault.getAbstractFileByPath(filePath);
        const fileLines = await this.getFileLines(filePath);
        const newFileLines: string[] = [...fileLines];
        newFileLines.splice(lineStart, lineEnd - lineStart, ...newContent);
        await this.app.vault.modify(file as TFile, newFileLines.join('\n'));
    }

    async updateObsidianTask(taskItemData: TaskItemData, filePath: string): Promise<void> {
        const [lineStart, lineEnd] = await this.getObsidianTaskLineNumber(taskItemData);
        const newContent = taskItemData.markdown;
        await this.updateFile(filePath, newContent, lineStart, lineEnd);
    }


}