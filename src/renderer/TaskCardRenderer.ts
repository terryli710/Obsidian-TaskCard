  import {
    MarkdownPostProcessor,
    MarkdownPostProcessorContext,
    MarkdownSectionInformation,
    htmlToMarkdown
  } from 'obsidian';
  import TaskCardPlugin from '..';
  import {
    getIndicesOfFilter,
    isTaskItemEl,
    isTaskList
  } from './filters';
  import { TaskValidator } from '../taskModule/taskValidator';
  import { TaskItemSvelteAdapter } from './postProcessor';
  import { ObsidianTaskSyncProps } from '../taskModule/taskSyncManager';
  import { logger } from '../utils/log';
  
  export interface TaskItemData {
    // HTML information about the TaskItem
    el: HTMLElement;
    origHTML: string;
    mdSectionInfo: MarkdownSectionInformation;
    lineNumberInSection: number;
    lineNumberEndsInSection?: number;
    markdown: string;
  }
  
  export class TaskCardRenderManager {
    private plugin: TaskCardPlugin;
    private taskItemFilter: (elems: HTMLElement) => boolean;

    constructor(plugin: TaskCardPlugin) {
      this.plugin = plugin;
  
      this.taskItemFilter = (
        (taskValidator: TaskValidator) => (elem: HTMLElement) =>
          isTaskItemEl(elem, taskValidator)
      )(this.plugin.taskValidator);
    }
  
    getPostProcessor(): MarkdownPostProcessor {
      const postProcessor = async (
        el: HTMLElement,
        ctx: MarkdownPostProcessorContext
      ) => {
        const taskSyncs: ObsidianTaskSyncProps[] = await this.constructTaskSync(el, ctx);
  
        for (const taskSync of taskSyncs) {
          // register taskStore
          const processor = new TaskItemSvelteAdapter(taskSync, this.plugin);
          processor.onload();
        }
  
      };
  
      return postProcessor;
    }
  
    async constructTaskSync(
      sectionDiv: HTMLElement,
      ctx: MarkdownPostProcessorContext
    ): Promise<ObsidianTaskSyncProps[]> {
      // markdownTask is null (not used here)
      const section: HTMLElement = sectionDiv.children[0] as HTMLElement;
      if (!isTaskList(section)) return [];
      const taskItemsIndices: number[] = getIndicesOfFilter(
        Array.from(section.children) as HTMLElement[],
        this.taskItemFilter
      );
      if (taskItemsIndices.length === 0) return [];
  
      const mdSectionInfo = ctx.getSectionInfo(section);
      const sourcePath = ctx.sourcePath;
      const mdSectionContent =
        await this.plugin.fileOperator.getMarkdownBetweenLines(
          sourcePath,
          mdSectionInfo.lineStart,
          mdSectionInfo.lineEnd + 1
        );
      // const lineNumbers: number[] = taskItemsIndices.map((index) =>
      //   getLineNumberOfListItem(section, index, mdSectionContent)
      // );

      const lineStartEndNumbers: { startLine: number, endLine: number }[] = taskItemsIndices.map((index) =>
        getLineNumbersOfListItem(section, index, mdSectionContent)
      );
  
  
      const taskSyncs: ObsidianTaskSyncProps[] = taskItemsIndices.map(
        (index, i) => {
          const taskItemEl: HTMLElement = section.children[index] as HTMLElement;
          const lineStartInSection = lineStartEndNumbers[i].startLine;
          const lineEndsInSection = lineStartEndNumbers[i].endLine;
          const obsidianTask = this.plugin.taskParser.parseTaskEl(taskItemEl);
          return {
            obsidianTask: obsidianTask,
            taskCardStatus: {
              descriptionStatus: 'done',
              projectStatus: 'done',
              dueStatus: 'done',
              durationStatus: 'done'
            },
            markdownTask: null,
            taskItemEl: taskItemEl,
            taskMetadata: {
              sectionEl: section,
              ctx: ctx,
              sourcePath: sourcePath,
              mdSectionInfo: mdSectionInfo,
              lineStartInSection: lineStartInSection,
              lineEndsInSection: lineEndsInSection
            }
          };
        }
      );
      return taskSyncs;
    }


  }
  
  export function getLineNumberOfListItem(
    ul: HTMLElement,
    index: number,
    content: string
  ): number {
    let lineNumber = 0;
    const originalLines = content.split('\n');
    let originalLineIndex = 0;
  
    for (let i = 0; i < index; i++) {
      const markdown = htmlToMarkdown(ul.children[i].innerHTML);
      const lines = markdown.split('\n').filter((line) => line.trim() !== '');
  
      lineNumber += lines.length;
  
      originalLineIndex += lines.length;
      // Count any empty lines that follow the current list item in the original content
      while (
        originalLines.length > originalLineIndex &&
        originalLines[originalLineIndex].trim() === ''
      ) {
        lineNumber++;
        originalLineIndex++;
      }
    }
  
    return lineNumber;
  }
  
  export function getLineNumbersOfListItem(
    ul: HTMLElement,
    index: number,
    content: string
  ): { startLine: number, endLine: number } {
    let startLine = 0;
    let endLine = 0;
    const originalLines = content.split('\n');
    let originalLineIndex = 0;
  
    // Loop through each list item up to the specified index
    for (let i = 0; i <= index; i++) {
      const markdown = htmlToMarkdown(ul.children[i].innerHTML);
      const lines = markdown.split('\n').filter((line) => line.trim() !== '');
  
      // If we're at the specified index, set the startLine
      if (i === index) {
        startLine = endLine;
      }
  
      // Update the end line number
      endLine += lines.length;
  
      originalLineIndex += lines.length;
      // Count any empty lines that follow the current list item in the original content
      while (
        originalLines.length > originalLineIndex &&
        originalLines[originalLineIndex].trim() === ''
      ) {
        endLine++;
        originalLineIndex++;
      }
    }
  
    return { startLine, endLine };

  }