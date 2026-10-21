import { App, MarkdownView, TFile, Vault } from 'obsidian';
import TaskCardPlugin from '..';
import { Notice } from 'obsidian';
import { logger } from '../utils/log';
import { indicatorTagPattern, isTagStart } from '../utils/regexUtils';
import { protectMarkdownSyntax } from '../utils/markdownSyntax';
import { markdownSourceContext } from '../utils/markdownSourceContext';
import { Project } from './project';
import { SettingStore } from '../settings';
import { ObsidianTask } from './task';
import type { SyncMappings } from '../api/syncTypes';
import {
  TASKS_EMOJI_SIGNIFIER,
  appendBlockId,
  mintTaskId
} from './fieldSyntax';


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
    window.setTimeout(() => {
      this.monitorFileToFormatTasks(file).catch((err) =>
        logger.error(`Failed to format tasks in ${file.path}: ${err}`)
      );
    }, 2);
  }

  // MONITORS
  // These two rewrite every markdown file in the vault. The per-file calls are
  // awaited rather than fired off together: unawaited, a large vault issues
  // thousands of concurrent reads/modifies and any failure becomes an
  // unhandled rejection. Sequential is slower but bounded and reportable.
  async monitorVaultToChangeIndicatorTags(vault: Vault, newIndicatorTag, oldIndicatorTag) {
    // iterate over all markdown files in the vault
    for (const file of vault.getMarkdownFiles()) {
      await this.changeIndicatorTagsForFile(file, newIndicatorTag, oldIndicatorTag);
    }
  }

  async monitorVaultToChangeProjects(vault: Vault, newProject: Project, oldProject: Project) {
    // iterate over all markdown files in the vault
    for (const file of vault.getMarkdownFiles()) {
      await this.changeProjectForFile(file, newProject, oldProject);
    }
  }

  /**
   * v2 registration pass (docs/format-spec.md): give every TaskCard task a
   * durable block id, convert legacy v1 notations (`%%*` / hidden span) to
   * the visible field format, and leave foreign dialects (Tasks emoji)
   * untouched apart from the appended id. Only the task line itself is
   * rewritten — description lines stay exactly where they are.
   */
  async monitorFileToFormatTasks(file: TFile) {
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines = [...lines];
    const taskDetails = this.detectTasksFromLines(lines);
    if (taskDetails.length === 0) return;
    for (const taskDetail of taskDetails) {
      const originalLine = lines[taskDetail.startLine];
      const isLegacy = this.plugin.taskValidator.hasLegacyNotation(originalLine);
      const isForeignDialect =
        !isLegacy && TASKS_EMOJI_SIGNIFIER.test(originalLine);
      const isNewTask = !isLegacy; // legacy span tasks were registered in v1

      const task = this.parseTaskWithLines(taskDetail.taskMarkdown.split('\n'));
      if (!task) continue;

      if (isForeignDialect) {
        // keep the user's dialect until they edit through a card — only the
        // identity is added
        task.id = mintTaskId();
        updatedLines[taskDetail.startLine] = appendBlockId(originalLine, task.id);
      } else {
        updatedLines[taskDetail.startLine] =
          this.plugin.taskFormatter.taskToLine(task);
      }

      if (isNewTask) {
        // No provider while calendar sync is suspended — leave any mappings
        // already stored for this task untouched rather than clearing them.
        const syncMetadata = await this.plugin.externalAPIManager?.createTask(task);
        if (syncMetadata) task.metadata.syncMappings = syncMetadata;
      }
      await this.plugin.storeSyncMappings(task.id, task.metadata.syncMappings);
    }
    await this.updateFileWithNewLines(file, updatedLines, lines);
  }

  /**
   * One-time migration (command): convert every legacy v1 task line in the
   * vault to the v2 field format. Returns the number of migrated tasks.
   */
  async migrateLegacyTasksInVault(vault: Vault): Promise<number> {
    let migratedCount = 0;
    for (const file of vault.getMarkdownFiles()) {
      const lines = await this.getLinesFromFile(file);
      if (!lines) continue;
      let fileChanged = false;
      // storeSyncMappings is a read-modify-write of the plugin's data.json, so
      // it cannot be fired off from inside the (synchronous) map callback:
      // concurrent writers each start from the same snapshot and the last one
      // to land silently drops the others' mappings. Collect, then persist
      // sequentially once the file's lines are known.
      const pendingMappings: { id: string; mappings: SyncMappings }[] = [];
      const context = markdownSourceContext(lines);
      const updatedLines = lines.map((line, index) => {
        if (!context.taskLines.has(index) || context.unsafeRewriteLines.has(index) ||
            !this.plugin.taskValidator.isTaskCardTaskMarkdown(context.maskedLines[index])) return line;
        if (!this.plugin.taskValidator.hasLegacyNotation(line)) return line;
        const task = this.plugin.taskParser.parseAnyTaskMarkdown(line);
        if (!task || task.content.length === 0) return line;
        const newLine = this.plugin.taskFormatter.taskToLine(task);
        pendingMappings.push({ id: task.id, mappings: task.metadata.syncMappings });
        migratedCount++;
        fileChanged = true;
        return newLine;
      });
      for (const { id, mappings } of pendingMappings) {
        await this.plugin.storeSyncMappings(id, mappings);
      }
      if (fileChanged) {
        await this.updateFileWithNewLines(file, updatedLines, lines);
      }
    }
    return migratedCount;
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
    if (this.plugin.taskValidator.isTaskCardTaskMarkdown(lines[0])) {
      const task = this.plugin.taskParser.parseAnyTaskMarkdown(taskMarkdown, announceError);
      // additional logic before adding the task: default project
      if (!task.project?.id && !task.project?.name && this.defaultProject?.id) {
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

  /** Lines that need a v2 registration/normalization pass. */
  private lineNeedsFormatting(line: string): boolean {
    if (!this.plugin.taskValidator.isTaskCardTaskMarkdown(line)) return false;
    return (
      !this.plugin.taskValidator.hasBlockId(line) ||
      this.plugin.taskValidator.hasLegacyNotation(line)
    );
  }

  detectTasksFromLines(lines: string[]): TaskDetail[] {
    const taskDetails: TaskDetail[] = [];
    const context = markdownSourceContext(lines);
    let lineIndex = 0;

    for (const line of lines) {
      if (context.taskLines.has(lineIndex) && !context.unsafeRewriteLines.has(lineIndex) &&
          this.lineNeedsFormatting(context.maskedLines[lineIndex])) {
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


  async changeIndicatorTagsForFile(file: TFile, newIndicatorTag, oldIndicatorTag) {
    // iterate over all lines in the file, find formatted tasks
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines: string[] = this.changeIndicatorTagsForLines(lines, newIndicatorTag, oldIndicatorTag);
    await this.updateFileWithNewLines(file, updatedLines, lines);
  }

  async changeProjectForFile(file: TFile, newProject, oldProject) {
    // iterate over all lines in the file, find formatted tasks
    const lines = await this.getLinesFromFile(file);
    if (!lines) return;
    const updatedLines: string[] = this.changeProjectForLines(lines, newProject, oldProject);
    await this.updateFileWithNewLines(file, updatedLines, lines);
  }

  changeIndicatorTagsForLines(lines: string[], newIndicatorTag, oldIndicatorTag): string[] {
    const context = markdownSourceContext(lines);
    return lines.map((line, index) => context.taskLines.has(index) &&
      this.plugin.taskValidator.isTaskCardTaskMarkdown(context.maskedLines[index], oldIndicatorTag)
      ? this.changeIndicatorTagForLine(line, newIndicatorTag, oldIndicatorTag, context.maskedLines[index]) : line);
  }

  changeProjectForLines(lines: string[], newProject, oldProject): string[] {
    const context = markdownSourceContext(lines);
    return lines.map((line, index) => context.taskLines.has(index) && !context.unsafeRewriteLines.has(index) &&
      this.plugin.taskValidator.isTaskCardTaskMarkdown(context.maskedLines[index])
      ? this.changeProjectForLine(line, newProject, oldProject) : line);
  }

  changeIndicatorTagForLine(line: string, newIndicatorTag, oldIndicatorTag, visibleLine = line) {
    if (this.plugin.taskValidator.isTaskCardTaskMarkdown(line, oldIndicatorTag)) {
      // Rename every real indicator prefix, preserving descendant suffixes
      // and literal tag examples inside code, links, and comments.
      const protectedSource = protectMarkdownSyntax(visibleLine);
      line = line.replace(indicatorTagPattern(oldIndicatorTag, true), (match: string, offset: number) =>
        isTagStart(line, offset) && !protectedSource.contains(offset) &&
          visibleLine.slice(offset, offset + match.length) === match
          ? `#${newIndicatorTag}` : match);
    }
    return line;
  }

  changeProjectForLine(line: string, newProject: Project, oldProject: Project) {
    if (this.plugin.taskValidator.isTaskCardTaskMarkdown(line)) {
      const task = this.plugin.taskParser.parseAnyTaskMarkdown(line);
      // v2 lines carry only the project *name* (the registry may already hold
      // the new name mid-rename), so match by name; ids still match legacy
      // span lines
      const matches =
        task.project &&
        (task.project.name === oldProject.name ||
          (task.project.id && task.project.id === oldProject.id));
      if (!matches) return line;
      task.project = newProject;
      return this.plugin.taskFormatter.taskToLine(task);
    }
    return line;
  }

  async getLinesFromFile(file: TFile): Promise<string[] | null> {
    return await this.plugin.fileOperator.getFileLines(file.path);
  }

  async updateFileWithNewLines(file: TFile, updatedLines: string[], originalLines: string[]) {
    await this.plugin.fileOperator.updateFile(
      file.path,
      updatedLines.join('\n'),
      0,
      originalLines.length,
      undefined,
      { source: originalLines.join('\n') }
    );
  }
}
