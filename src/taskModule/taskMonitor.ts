import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import TaskCardPlugin from '..';
import { Notice } from 'obsidian';
import { logger } from '../utils/log';


export class TaskMonitor {
  plugin: TaskCardPlugin;
  app: App;

  constructor(plugin: TaskCardPlugin, app: App) {
    this.plugin = plugin;
    this.app = app;
  }

  async monitorFileToFormatTasks(file: TFile) {
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines = this.updateTasksInLines(lines);
    await this.updateFileWithNewLines(file, updatedLines);
  }

  layoutChangeHandler() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const mode = view.getMode();
    if (mode !== 'preview') return;
    setTimeout(() => {
      this.monitorFileToFormatTasks(file);
    }, 2);
  }

  async getLinesFromFile(file: TFile): Promise<string[] | null> {
    return await this.plugin.fileOperator.getFileLines(file.path);
  }

  updateTasksInLines(lines: string[]): string[] {
    return lines.map((line, index) => this.updateTaskInLine(line, index));
  }

  updateTaskInLine(line: string, index: number): string {
    function announceError(errorMsg: string): void {
      // Show a notice popup
      new Notice(errorMsg);
      // Log the error
      logger.error(errorMsg);
    }
    if (this.plugin.taskValidator.isValidUnformattedTaskMarkdown(line)) {
      const task = this.plugin.taskParser.parseTaskMarkdown(line, announceError);
      return this.plugin.taskFormatter.taskToMarkdownOneLine(task);
    }
    return line;
  }

  async updateFileWithNewLines(file: TFile, updatedLines: string[]) {
    await this.plugin.fileOperator.updateFile(
      file.path,
      updatedLines.join('\n'),
      0,
      updatedLines.length
    );
  }
}
