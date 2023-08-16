import { App, TAbstractFile, TFile } from "obsidian";
import TaskCardPlugin from "..";


export class FileOperator {
    app: App;
    plugin: TaskCardPlugin;

    constructor(plugin: TaskCardPlugin, app: App) {
        this.plugin = plugin;
        this.app = app;
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

    async getMarkdownBetweenLines(filePath: string, lineStart: number, lineEnd: number): Promise<string> {
        const fileLines = await this.getFileLines(filePath);
        return fileLines.slice(lineStart, lineEnd).join('\n');
    }

    async updateFile(filePath: string, newContent: string, lineStart: number, lineEnd: number): Promise<void> {
        const file = await this.app.vault.getAbstractFileByPath(filePath);
        const fileLines = await this.getFileLines(filePath);
        const newFileLines: string[] = [...fileLines];
        newFileLines.splice(lineStart, lineEnd - lineStart, ...newContent);
        await this.app.vault.modify(file as TFile, newFileLines.join('\n'));
    }

}