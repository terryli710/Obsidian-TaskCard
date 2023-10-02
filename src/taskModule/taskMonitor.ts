import { App, MarkdownView, TFile, Vault, WorkspaceLeaf } from 'obsidian';
import TaskCardPlugin from '..';
import { Notice } from 'obsidian';
import { logger } from '../utils/log';
import { TaskDisplayMode } from '../renderer/postProcessor';
import { Project } from './project';


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

  async changeDisplayModeCommandHandler(mode: TaskDisplayMode) {
    await this.monitorFileToChangeTaskDisplayModes(this.app.workspace.getActiveFile(), mode);
  }

  // MONITORS
  async monitorVaultToChangeIndicatorTags(vault: Vault, newIndicatorTag, oldIndicatorTag) {
    // iterate over all markdown files in the vault
    for (const file of vault.getMarkdownFiles()) {
      this.changeIndicatorTagsForFile(file, newIndicatorTag, oldIndicatorTag);
    }
  }

  async monitorVaultToChangeProjects(vault: Vault, newProject: Project, oldProject: Project) {
    // iterate over all markdown files in the vault
    for (const file of vault.getMarkdownFiles()) {
      this.changeProjectForFile(file, newProject, oldProject);
    }
  }

  // HACK: currently don't have to parse description as it doesn't affect anything
  async monitorFileToFormatTasks(file: TFile) { 
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines = this.formatTaskInLines(lines);
    await this.updateFileWithNewLines(file, updatedLines);
  }

  async monitorFileToChangeTaskDisplayModes(file: TFile, mode: TaskDisplayMode) {
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines = this.changeTaskDisplayModesInLines(lines, mode);
    await this.updateFileWithNewLines(file, updatedLines);
  }

  // HELPERS

  changeTaskDisplayModesInLines(lines: string[], mode: TaskDisplayMode): string[] {
    return lines.map((line, index) => this.changeTaskDisplayModeInLine(line, mode));
  }

  changeTaskDisplayModeInLine(line: string, mode: TaskDisplayMode): string {
    if (this.plugin.taskValidator.isValidFormattedTaskMarkdown(line)) {
      const task = this.plugin.taskParser.parseFormattedTaskMarkdown(line);
      task.metadata.taskDisplayParams.mode = mode;
      return this.plugin.taskFormatter.taskToMarkdown(task);
    }
    return line;
  }

  async changeIndicatorTagsForFile(file: TFile, newIndicatorTag, oldIndicatorTag) {
    // iterate over all lines in the file, find formatted tasks
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines: string[] = this.changeIndicatorTagsForLines(lines, newIndicatorTag, oldIndicatorTag);
    await this.updateFileWithNewLines(file, updatedLines);
  }

  async changeProjectForFile(file: TFile, newProject, oldProject) {
    // iterate over all lines in the file, find formatted tasks
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines: string[] = this.changeProjectForLines(lines, newProject, oldProject);
    await this.updateFileWithNewLines(file, updatedLines);
  }

  changeIndicatorTagsForLines(lines: string[], newIndicatorTag, oldIndicatorTag): string[] {
    return lines.map((line, index) => this.changeIndicatorTagForLine(line, newIndicatorTag, oldIndicatorTag));
  }

  changeProjectForLines(lines: string[], newProject, oldProject): string[] {
    return lines.map((line, index) => this.changeProjectForLine(line, newProject, oldProject));
  }

  changeIndicatorTagForLine(line: string, newIndicatorTag, oldIndicatorTag) {
    if (this.plugin.taskValidator.isValidFormattedTaskMarkdown(line, oldIndicatorTag)) {
      // formatted task will only have one indicator tag at the correct position
      // so we can safely replace it
      line = line.replace(oldIndicatorTag, newIndicatorTag);
    }
    return line;
  }

  changeProjectForLine(line: string, newProject: Project, oldProject: Project) {
    if (this.plugin.taskValidator.isValidFormattedTaskMarkdown(line)) {
      const task = this.plugin.taskParser.parseFormattedTaskMarkdown(line);
      if (task.project.id !== oldProject.id) return line;
      task.project = newProject;
      const updatedLine = this.plugin.taskFormatter.taskToMarkdown(task);
      return updatedLine;
    }
    return line;
  }

  async getLinesFromFile(file: TFile): Promise<string[] | null> {
    return await this.plugin.fileOperator.getFileLines(file.path);
  }

  formatTaskInLines(lines: string[]): string[] {
    return lines.map((line, index) => this.formatTaskInLine(line, index));
  }

  formatTaskInLine(line: string, index: number): string {
    function announceError(errorMsg: string): void {
      // Show a notice popup
      new Notice(errorMsg);
      // Log the error
      logger.error(errorMsg);
    }
    if (this.plugin.taskValidator.isValidUnformattedTaskMarkdown(line)) {
      const task = this.plugin.taskParser.parseTaskMarkdown(line, announceError);
      return this.plugin.taskFormatter.taskToMarkdown(task);
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
