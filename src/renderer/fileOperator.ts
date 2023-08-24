import { App, TAbstractFile, TFile } from 'obsidian';
import TaskCardPlugin from '..';
import { logger } from '../utils/log';

export class FileOperator {
  app: App;
  plugin: TaskCardPlugin;

  constructor(plugin: TaskCardPlugin, app: App) {
    this.plugin = plugin;
    this.app = app;
  }

  async getFileContent(filePath: string): Promise<string | null> {
    const file: TAbstractFile = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return null;
    const content = await this.app.vault.read(file as TFile);
    return content;
  }

  async getFileLines(filePath: string): Promise<string[] | null> {
    const content = await this.getFileContent(filePath);
    if (!content) return null;
    return content.split('\n');
  }

  async getMarkdownBetweenLines(
    filePath: string,
    lineStart: number,
    lineEnd: number
  ): Promise<string | null> {
    const fileLines = await this.getFileLines(filePath);
    if (!fileLines) return null;
    return fileLines.slice(lineStart, lineEnd).join('\n');
  }

  async updateFile(
    filePath: string,
    newContent: string,
    lineStart: number,
    lineEnd: number
  ): Promise<void> {
    const file = await this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;
    const fileLines = await this.getFileLines(filePath);
    const newFileLines: string[] = [...fileLines];
    newFileLines.splice(lineStart, lineEnd - lineStart, newContent);
    // logger.debug(`newContent: ${newContent}, lineStart: ${lineStart}, lineEnd: ${lineEnd}`);
    await this.app.vault.modify(file as TFile, newFileLines.join('\n'));
  }
}
