import { App, MarkdownView, TFile, Vault, WorkspaceLeaf } from 'obsidian';
import TaskCardPlugin from '..';
import { Notice } from 'obsidian';
import { logger } from '../utils/log';
import { TaskDisplayMode } from '../renderer/postProcessor';
import { Project } from './project';
import { SettingStore } from '../settings';
import { ObsidianTask } from './task';


interface TaskDetail {
  taskMarkdown: string;
  startLine: number;
  endLine: number;
}

export class TaskMonitor {
  plugin: TaskCardPlugin;
  app: App;

  defaultProject: Project;

  constructor(plugin: TaskCardPlugin, app: App, settingsStore: typeof SettingStore) {
    this.plugin = plugin;
    this.app = app;

    settingsStore.subscribe((settings) => {
      this.defaultProject = settings.userMetadata.defaultProject;
    })
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
    let updatedLines = lines;
    if (!lines) return;
    const taskDetails = this.detectTasksFromLines(lines);
    if (taskDetails.length === 0) return;
    for (const taskDetail of taskDetails) {
      // logger.debug(`taskDetail: ${JSON.stringify(taskDetail)}`);
      // notify API about creation of tasks
      let task = this.parseTaskWithLines(taskDetail.taskMarkdown.split('\n'));
      const syncMetadata = await this.plugin.externalAPIManager.createTask(task);
      task.metadata.syncMappings = syncMetadata;
      // logger.debug(`task.metadata: ${JSON.stringify(task.metadata)}`);
      // format task lines
      let newLines = this.plugin.taskFormatter.taskToMarkdown(task).split('\n');
      
      // insert task lines to lines of the file
      updatedLines = updatedLines.slice(0, taskDetail.startLine).concat(newLines, updatedLines.slice(taskDetail.endLine));
    }
    await this.updateFileWithNewLines(file, updatedLines);
  }

  async monitorFileToChangeTaskDisplayModes(file: TFile, mode: TaskDisplayMode) {
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines = this.changeTaskDisplayModesInLines(lines, mode);
    await this.updateFileWithNewLines(file, updatedLines);
  }


  // HELPERS

  parseTaskWithLines(lines: string[]): ObsidianTask {

    function announceError(errorMsg: string): void {
      // Show a notice popup
      new Notice(errorMsg);
      // Log the error
      logger.error(errorMsg);
    }

    const taskMarkdown = lines.join('\n');
    if (this.plugin.taskValidator.isValidUnformattedTaskMarkdown(lines[0])) {
      const task = this.plugin.taskParser.parseTaskMarkdown(taskMarkdown, announceError);
      // additional logic before adding the task: default project
      if (!task.project?.id && this.defaultProject?.id) {
        // logger.debug('No project found, using default project');
        task.project = this.defaultProject;
      }
      return task;
    } else {
      announceError('Failed to parse task: ' + taskMarkdown);
      return null;
    }

  }

  formatTaskWithLines(lines: string[]): string[] {
    const task = this.parseTaskWithLines(lines);
    if (!task) return [''];
    return this.plugin.taskFormatter.taskToMarkdown(task).split('\n');
  }

  detectTasksFromLines(lines: string[]): TaskDetail[] {
    const taskDetails: TaskDetail[] = [];
    let lineIndex = 0;

    for (const line of lines) {
      if (this.plugin.taskValidator.isValidUnformattedTaskMarkdown(line)) {
        // Count how many lines are in the description
        const followingLines = lines.slice(lineIndex + 1);
        const descriptionLineCount = this.countDescriptionLines(line, followingLines);

        // Create a string that includes the task and its descriptions
        const taskWithDescription = lines.slice(lineIndex, lineIndex + 1 + descriptionLineCount).join('\n');

        // Create an object with the task, start line, and end line, then add it to the array
        taskDetails.push({
          taskMarkdown: taskWithDescription,
          startLine: lineIndex,
          endLine: lineIndex + 1 + descriptionLineCount,
        });

      }
      lineIndex++;
    }

    return taskDetails;
  }

  countDescriptionLines(taskLine: string, followingLines: string[]): number {
    // Function to count the leading spaces of a line
    function countLeadingSpaces(line) {
      return line.match(/^(\s*)/)[0].length;
    }
  
    // Function to check if a line starts with specific characters
    function startsWithSymbols(line) {
      return /^\s*([-] \[[ xX]\]|[-] |[1-9]+\. )/.test(line);
    }
  
    // Function to check if a line is not empty or all spaces
    function isNotEmpty(line) {
      return line.trim().length > 0;
    }
  
    const taskIndentation = countLeadingSpaces(taskLine);
  
    let descriptionLineCount = 0;
  
    for (const line of followingLines) {
      // Check if the line is indented more than the task
      const hasMoreIndentation = countLeadingSpaces(line) > taskIndentation;
  
      // Check if the line starts with the specified symbols and is not empty
      const isValidStart = startsWithSymbols(line) && isNotEmpty(line);
  
      if (hasMoreIndentation && isValidStart) {
        // This line is part of the description
        descriptionLineCount++;
      } else {
        // We've reached the end of the description
        break;
      }
    }
  
    return descriptionLineCount;
  }


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

  async updateFileWithNewLines(file: TFile, updatedLines: string[]) {
    await this.plugin.fileOperator.updateFile(
      file.path,
      updatedLines.join('\n'),
      0,
      updatedLines.length
    );
  }
}
