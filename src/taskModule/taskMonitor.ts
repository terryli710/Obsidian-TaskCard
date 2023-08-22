import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import TaskCardPlugin from '..';

export class TaskMonitor {
  plugin: TaskCardPlugin;
  app: App;

  constructor(plugin: TaskCardPlugin, app: App) {
    this.plugin = plugin;
    this.app = app;
  }

  async monitorFile(file: TFile) {
    const lines = await this.getLinesFromFile(file);
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
      this.monitorFile(file);
    }, 2);
  }

  async getLinesFromFile(file: TFile) {
    return await this.plugin.fileOperator.getFileLines(file.path);
  }

  updateTasksInLines(lines: string[]): string[] {
    return lines.map((line, index) => this.updateTaskInLine(line, index));
  }

  updateTaskInLine(line: string, index: number): string {
    if (this.plugin.taskValidator.isValidUnformattedTaskMarkdown(line)) {
      const task = this.plugin.taskParser.parseTaskMarkdown(line);
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
