  import {
    MarkdownPostProcessor,
    MarkdownPostProcessorContext,
    MarkdownSectionInformation,
    htmlToMarkdown
  } from 'obsidian';
  import TaskCardPlugin from '..';
  import {
    isTaskItemEl,
    isTaskList
  } from './filters';
  import { TaskValidator } from '../taskModule/taskValidator';
  import { TaskItemSvelteAdapter } from './postProcessor';
  import { countFormattedDescriptionLines, ObsidianTaskSyncProps } from '../taskModule/taskSyncManager';
  
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
      const postProcessor: MarkdownPostProcessor = async (
        el: HTMLElement,
        ctx: MarkdownPostProcessorContext
      ) => {
        // Markdown rendered inside a card (including note embeds) belongs
        // to that card, and must never mount another writable task card.
        if (el.closest('[data-taskcard-markdown]')) return;
        // Hide raw task items before the first await: once this function
        // yields, the browser may paint the section, and an unhidden item
        // shows as a plain checkbox line until its card mounts (the
        // re-render "blink").
        const pendingItems = this.hideTaskItemsPendingMount(el);
        try {
          // Obsidian starts async post processors concurrently. Let their
          // microtasks finish before capturing nodes: Dataview awaits each
          // text container and can replace a parent LI later in its loop.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          for (const item of this.hideTaskItemsPendingMount(el)) {
            pendingItems.add(item);
          }
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

      // Dataview renders inline fields at 100 and replaces the containing
      // list item's children. Mount afterward so cards use the final nodes.
      postProcessor.sortOrder = 200;
      return postProcessor;
    }

    // Same detection as constructTaskSync, but fully synchronous (pure DOM
    // inspection) so it can run before any paint-eligible boundary.
    private getTaskItems(section: HTMLElement): HTMLElement[] {
      if (!isTaskList(section)) return [];
      const items = Array.from(section.querySelectorAll<HTMLElement>('li'))
        .filter((item) =>
          !item.classList.contains('obsidian-taskcard-live') &&
          !item.classList.contains('obsidian-taskcard-source-hidden') &&
          this.taskItemFilter(item)
        );
      const taggedItems = new Set(items);
      // A tagged parent owns its description and subtasks. Nested tasks
      // under plain weekly-plan bullets are independent cards instead.
      return items.filter((item) => {
        let ancestor = item.parentElement?.closest('li');
        while (ancestor && section.contains(ancestor)) {
          if (taggedItems.has(ancestor)) return false;
          ancestor = ancestor.parentElement?.closest('li');
        }
        return true;
      });
    }

    private hideTaskItemsPendingMount(sectionDiv: HTMLElement): Set<HTMLElement> {
      const pendingItems = new Set<HTMLElement>();
      const section: HTMLElement = sectionDiv.children[0] as HTMLElement;
      for (const item of this.getTaskItems(section)) {
        item.classList.add('obsidian-taskcard-mount-pending');
        pendingItems.add(item);
      }
      return pendingItems;
    }
  
    async constructTaskSync(
      sectionDiv: HTMLElement,
      ctx: MarkdownPostProcessorContext
    ): Promise<ObsidianTaskSyncProps[]> {
      // markdownTask is null (not used here)
      const section: HTMLElement = sectionDiv.children[0] as HTMLElement;
      const taskItems = this.getTaskItems(section);
      if (taskItems.length === 0) return [];
  
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
      const taskSyncs: ObsidianTaskSyncProps[] = taskItems.flatMap(
        (taskItemEl) => {
          const parentList = taskItemEl.parentElement;
          const dataLine = getTaskDataLine(taskItemEl);
          // Native positions are relative to the whole rendered section,
          // even in nested lists. Do not guess a nested task's source line
          // from HTML: comments and Dataview fields change its line count.
          if (dataLine != null && (!/^\d+$/.test(dataLine) || Number(dataLine) >= sectionLines.length)) return [];
          if (dataLine == null && parentList !== section) return [];
          const index = Array.from(parentList.children).indexOf(taskItemEl);
          const { startLine: lineStartInSection, endLine: lineEndsInSection } =
            getLineNumbersOfListItem(parentList, index, mdSectionContent);
          if (!this.plugin.taskValidator.isTaskCardTaskMarkdown(sectionLines[lineStartInSection])) return [];
          // v2: attributes live visibly on the source line — parse the source,
          // never the rendered DOM (which Dataview and themes may transform)
          const obsidianTask = this.plugin.taskParser.parseAnyTaskFromFileLines(
            sectionLines.slice(lineStartInSection, lineEndsInSection)
          );
          this.plugin.hydrateSyncMappings(obsidianTask);
          return [{
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
          }];
        }
      );
      return taskSyncs;
    }


  }

  function getTaskDataLine(item: HTMLElement): string | null {
    return item.getAttribute?.('data-line') ??
      item.querySelector?.('.task-list-item-checkbox')?.getAttribute('data-line') ?? null;
  }
  
  export function getLineNumbersOfListItem(
    ul: HTMLElement,
    index: number,
    content: string
  ): { startLine: number, endLine: number } {
    let startLine = 0;
    const originalLines = content.split('\n');
    let originalLineIndex = 0;
    const dataLine = getTaskDataLine(ul.children[index] as HTMLElement);
    if (dataLine != null && /^\d+$/.test(dataLine)) {
      startLine = Number(dataLine);
      return {
        startLine,
        endLine: startLine + 1 + countFormattedDescriptionLines(originalLines, startLine)
      };
    }

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
