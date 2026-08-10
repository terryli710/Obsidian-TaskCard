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
        // Hide raw task items before the first await: once this function
        // yields, the browser may paint the section, and an unhidden item
        // shows as a plain checkbox line until its card mounts (the
        // re-render "blink").
        const pendingItems = this.hideTaskItemsPendingMount(el);
        try {
          const taskSyncs: ObsidianTaskSyncProps[] = await this.constructTaskSync(el, ctx);

          for (const taskSync of taskSyncs) {
            // register with the context so Obsidian drives load/unload and the
            // Svelte component is destroyed when the section re-renders
            ctx.addChild(new TaskItemSvelteAdapter(taskSync, this.plugin));
            pendingItems.delete(taskSync.taskItemEl);
          }
        } finally {
          // items that didn't become a card (detached section, parse failure)
          // must reappear as plain markdown, not stay invisible
          for (const item of pendingItems) {
            item.classList.remove('obsidian-taskcard-mount-pending');
          }
        }
      };

      return postProcessor;
    }

    // Same detection as constructTaskSync, but fully synchronous (pure DOM
    // inspection) so it can run before any paint-eligible boundary.
    private hideTaskItemsPendingMount(sectionDiv: HTMLElement): Set<HTMLElement> {
      const pendingItems = new Set<HTMLElement>();
      const section: HTMLElement = sectionDiv.children[0] as HTMLElement;
      if (!isTaskList(section)) return pendingItems;
      for (const child of Array.from(section.children)) {
        const item = child as HTMLElement;
        if (this.taskItemFilter(item)) {
          item.classList.add('obsidian-taskcard-mount-pending');
          pendingItems.add(item);
        }
      }
      return pendingItems;
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
      // the section element can already be detached when a re-render races us
      if (!mdSectionInfo) return [];
      const sourcePath = ctx.sourcePath;
      const mdSectionContent =
        await this.plugin.fileOperator.getMarkdownBetweenLinesForDisplay(
          sourcePath,
          mdSectionInfo.lineStart,
          mdSectionInfo.lineEnd + 1
        );
      if (mdSectionContent == null) return [];
      const sectionLines = mdSectionContent.split('\n');
      const lineStartEndNumbers: { startLine: number, endLine: number }[] = taskItemsIndices.map((index) =>
        getLineNumbersOfListItem(section, index, mdSectionContent)
      );


      const taskSyncs: ObsidianTaskSyncProps[] = taskItemsIndices.map(
        (index, i) => {
          const taskItemEl: HTMLElement = section.children[index] as HTMLElement;
          const lineStartInSection = lineStartEndNumbers[i].startLine;
          const lineEndsInSection = lineStartEndNumbers[i].endLine;
          // v2: attributes live visibly on the source line — parse the source,
          // never the rendered DOM (which Dataview and themes may transform)
          const obsidianTask = this.plugin.taskParser.parseAnyTaskFromFileLines(
            sectionLines.slice(lineStartInSection, lineEndsInSection)
          );
          this.plugin.hydrateSyncMappings(obsidianTask);
          return {
            obsidianTask: obsidianTask,
            taskCardStatus: {
              descriptionStatus: 'done',
              projectStatus: 'done',
              scheduleStatus: 'done',
              dueStatus: 'done',
              durationStatus: 'done',
              recurrenceStatus: 'done'
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
  
  export function getLineNumbersOfListItem(
    ul: HTMLElement,
    index: number,
    content: string
  ): { startLine: number, endLine: number } {
    let startLine = 0;
    const originalLines = content.split('\n');
    let originalLineIndex = 0;

    // Advance past every list item before the requested one
    for (let i = 0; i < index; i++) {
      const markdown = htmlToMarkdown(ul.children[i].innerHTML);
      const lines = markdown.split('\n').filter((line) => line.trim() !== '');

      startLine += lines.length;
      originalLineIndex += lines.length;
      // Blank lines between items position the next item but belong to the
      // document, not to any item's span (known-issues #3)
      while (
        originalLines.length > originalLineIndex &&
        originalLines[originalLineIndex].trim() === ''
      ) {
        startLine++;
        originalLineIndex++;
      }
    }

    const markdown = htmlToMarkdown(ul.children[index].innerHTML);
    const lines = markdown.split('\n').filter((line) => line.trim() !== '');

    return { startLine, endLine: startLine + lines.length };
  }