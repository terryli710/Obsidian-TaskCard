import { App, MarkdownView, TFile, Vault, WorkspaceLeaf } from 'obsidian';
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

  // HANDLERS

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

  // MONITORS

  async monitorVaultToChangeIndicatorTags(vault: Vault, newIndicatorTag, oldIndicatorTag) {
    // iterate over all markdown files in the vault
    for (const file of vault.getMarkdownFiles()) {
      this.changeIndicatorTagsForFile(file, newIndicatorTag, oldIndicatorTag);
    }
  }

  async monitorFileToFormatTasks(file: TFile) {
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines = this.updateTasksInLines(lines);
    await this.updateFileWithNewLines(file, updatedLines);
  }

  // HELPERS

  async changeIndicatorTagsForFile(file: TFile, newIndicatorTag, oldIndicatorTag) {
    // iterate over all lines in the file, find formatted tasks
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines: string[] = this.changeIndicatorTagsForLines(lines, newIndicatorTag, oldIndicatorTag);
    await this.updateFileWithNewLines(file, updatedLines);
  }

  changeIndicatorTagsForLines(lines: string[], newIndicatorTag, oldIndicatorTag): string[] {
    return lines.map((line, index) => this.changeIndicatorTagForLine(line, newIndicatorTag, oldIndicatorTag));
  }

  changeIndicatorTagForLine(line: string, newIndicatorTag, oldIndicatorTag) {
    if (this.plugin.taskValidator.isValidFormattedTaskMarkdown(line, oldIndicatorTag)) {
      // formatted task will only have one indicator tag at the correct position
      // so we can safely replace it
      line = line.replace(oldIndicatorTag, newIndicatorTag);
    }
    return line;
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
