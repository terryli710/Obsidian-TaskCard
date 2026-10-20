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
  import type { TaskDisplayParams } from './postProcessor';
  import { extractBlockId } from '../taskModule/fieldSyntax';
  import { markdownSourceContext } from '../utils/markdownSourceContext';
  
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
    // A section is replaced on every source edit, but its preview pane survives.
    // Keep UI state there, scoped by file and task identity, without writing it
    // into Markdown or sharing it with another pane showing the same note.
    private displayParamsByView = new WeakMap<Element, Map<string, TaskDisplayParams>>();
    private pendingVisualsByDocument = new Map<string, {
      visuals: Map<string, HTMLElement>;
      expiry: ReturnType<typeof setTimeout>;
    }>();

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
          this.restorePendingVisuals(el, ctx);
          // Dataview can replace a parent LI after awaiting preceding text
          // containers. Mount on the surviving nodes in an animation callback;
          // the snapshots cover any intervening frame of the section refresh.
          await new Promise<void>((resolve) => {
            const win = el.ownerDocument.defaultView;
            let frame: number;
            const finish = () => {
              clearTimeout(fallback);
              if (frame !== undefined) win?.cancelAnimationFrame?.(frame);
              resolve();
            };
            // Background windows may suspend animation frames entirely.
            const fallback = setTimeout(finish, win?.requestAnimationFrame ? 50 : 0);
            frame = win?.requestAnimationFrame?.(finish);
          });
          for (const item of this.hideTaskItemsPendingMount(el)) {
            pendingItems.add(item);
          }
          const taskSyncs = this.constructTaskSync(el, ctx);

          for (const taskSync of taskSyncs) {
            // register with the context so Obsidian drives load/unload and the
            // Svelte component is destroyed when the section re-renders
            ctx.addChild(new TaskItemSvelteAdapter(taskSync, this.plugin));
            pendingItems.delete(taskSync.taskItemEl);
          }
        } finally {
          for (const placeholder of el.querySelectorAll('.obsidian-taskcard-render-placeholder')) {
            placeholder.remove();
          }
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
      if (!section) return [];
      // Obsidian emits native task lists directly, or inside quote/callout
      // sections. Other rendered containers may belong to another processor.
      const quotedTaskList = section.matches('blockquote, .callout') &&
        section.querySelector('ul.contains-task-list, ol.contains-task-list');
      if (!isTaskList(section) && !quotedTaskList) return [];
      const items = Array.from(section.querySelectorAll<HTMLElement>('li'))
        .filter((item) =>
          isTaskList(item.parentElement) &&
          !item.closest('[data-taskcard-markdown], .internal-embed, [class*="block-language-"], .dataview') &&
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
  
    rememberTaskDisplayParams(taskSync: Pick<ObsidianTaskSyncProps, 'obsidianTask' | 'taskMetadata'>): void {
      const view = taskSync.taskMetadata.sectionEl?.closest('.markdown-preview-view');
      if (!view) return;
      let states = this.displayParamsByView.get(view);
      if (!states) {
        states = new Map();
        this.displayParamsByView.set(view, states);
      }
      const { sourcePath, mdSectionInfo, lineStartInSection } = taskSync.taskMetadata;
      if (!mdSectionInfo || lineStartInSection == null) return;
      const key = taskVisualKey(sourcePath, mdSectionInfo.text.split('\n'),
        mdSectionInfo.lineStart + lineStartInSection);
      const params = taskSync.obsidianTask.metadata.taskDisplayParams;
      if (params) states.set(key, { ...params });
      else states.delete(key);
    }

    prepareTaskWrite(taskSync: Pick<ObsidianTaskSyncProps, 'obsidianTask' | 'taskMetadata' | 'taskItemEl'>,
      markdownTask?: string): (() => void) | undefined {
      this.rememberTaskDisplayParams(taskSync);
      const { sectionEl, ctx, sourcePath } = taskSync.taskMetadata;
      const view = sectionEl?.closest('.markdown-preview-view');
      const info = view && ctx?.getSectionInfo(sectionEl);
      if (!info || !ctx.docId) return;
      const lines = info.text.split('\n');
      const { lineStartInSection, lineEndsInSection } = taskSync.taskMetadata;
      if (lineStartInSection == null || lineEndsInSection == null) return;
      const start = info.lineStart + lineStartInSection;
      const end = info.lineStart + lineEndsInSection;
      const writtenLines = markdownTask?.split('\n') ?? lines.slice(start, end);
      const nextLines = [...lines.slice(0, start), ...writtenLines, ...lines.slice(end)];
      const delta = writtenLines.length - (end - start);
      const nextLine = (line: number) => line >= end ? line + delta : line;
      // Newly added tasks can still lack IDs until their first card edit. Use
      // source positions in that case, and move those positions with this write.
      // Including the source line prevents a stale state from landing on a new
      // task at the same position; duplicate titles keep independent modes.
      const remap = <T>(entries: Map<string, T>) => {
        const moved: [string, T][] = [];
        for (const [key, value] of entries) {
          const [path, kind, line, text] = JSON.parse(key);
          if (path !== sourcePath || kind !== 'line' || lines[line] !== text) continue;
          entries.delete(key);
          moved.push([taskVisualKey(sourcePath, nextLines, nextLine(line)), value]);
        }
        for (const [key, value] of moved) entries.set(key, value);
      };
      const previous = this.pendingVisualsByDocument.get(ctx.docId);
      if (previous) clearTimeout(previous.expiry);
      // Another section may still be awaiting replacement after a quick save.
      const visuals = previous?.visuals ?? new Map<string, HTMLElement>();
      remap(visuals);
      // A failed write or a closed pane might never consume the snapshots.
      // Keep them transient even in that case.
      const expiry = setTimeout(() => this.pendingVisualsByDocument.delete(ctx.docId), 5000);
      this.pendingVisualsByDocument.set(ctx.docId, { visuals, expiry });
      // Obsidian can tear down a whole list during an already-started frame.
      // Preserve every card in that list, not just the card whose field changed.
      for (const card of sectionEl.querySelectorAll<HTMLElement>('li.obsidian-taskcard-live')) {
        const sourceItem = card.nextElementSibling as HTMLElement;
        const dataLine = sourceItem && getTaskDataLine(sourceItem);
        if (!sourceItem?.classList.contains('obsidian-taskcard-source-hidden') ||
            dataLine == null || !/^\d+$/.test(dataLine)) continue;
        const line = info.lineStart + Number(dataLine);
        const key = taskVisualKey(sourcePath, nextLines, nextLine(line));
        const snapshot = card.cloneNode(true) as HTMLElement;
        snapshot.classList.add('obsidian-taskcard-render-placeholder');
        snapshot.setAttribute('inert', '');
        snapshot.setAttribute('aria-hidden', 'true');
        visuals.set(key, snapshot);
      }
      // The vault can reject a write. Commit mode positions only once it
      // succeeds; until then they still belong to the original source.
      return () => {
        const states = this.displayParamsByView.get(view);
        if (states) remap(states);
      };
    }

    private restorePendingVisuals(sectionDiv: HTMLElement, ctx: MarkdownPostProcessorContext): void {
      // Obsidian invokes processors on detached replacement sections, with a
      // fresh context object but the same document ID. DOM ancestry is not yet
      // available here; docId also keeps two panes of the same file separate.
      const pending = this.pendingVisualsByDocument.get(ctx.docId);
      const visuals = pending?.visuals;
      if (!visuals?.size) return;
      const section = sectionDiv.children[0] as HTMLElement;
      const info = section && ctx.getSectionInfo(section);
      if (!info) return;
      const lines = info.text.split('\n');
      for (const item of this.getTaskItems(section)) {
        const dataLine = getTaskDataLine(item);
        if (dataLine == null || !/^\d+$/.test(dataLine)) continue;
        const key = taskVisualKey(ctx.sourcePath, lines, info.lineStart + Number(dataLine));
        const snapshot = visuals.get(key);
        if (!snapshot) continue;
        item.before(snapshot);
        visuals.delete(key);
      }
      if (!visuals.size) {
        clearTimeout(pending.expiry);
        this.pendingVisualsByDocument.delete(ctx.docId);
      }
    }

    constructTaskSync(
      sectionDiv: HTMLElement,
      ctx: MarkdownPostProcessorContext
    ): ObsidianTaskSyncProps[] {
      // markdownTask is null (not used here)
      const section: HTMLElement = sectionDiv.children[0] as HTMLElement;
      const taskItems = this.getTaskItems(section);
      if (taskItems.length === 0) return [];
  
      const mdSectionInfo = ctx.getSectionInfo(section);
      // the section element can already be detached when a re-render races us
      if (!mdSectionInfo) return [];
      const sourcePath = ctx.sourcePath;
      // getSectionInfo.text is the full source snapshot used for this render.
      // Reading the vault here adds an async paint gap and can pair newer source
      // text with older DOM positions. Finish construction/mounting synchronously.
      const sourceLines = mdSectionInfo.text.split('\n');
      const sourceContext = markdownSourceContext(sourceLines);
      const mdSectionContent = sourceLines
        .slice(mdSectionInfo.lineStart, mdSectionInfo.lineEnd + 1).join('\n');
      const sectionLines = mdSectionContent.split('\n');
      const view = sectionDiv.closest('.markdown-preview-view');
      const displayStates = view && this.displayParamsByView.get(view);
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
          if (!sourceContext.taskLines.has(mdSectionInfo.lineStart + lineStartInSection) ||
              !this.plugin.taskValidator.isTaskCardTaskMarkdown(sectionLines[lineStartInSection])) return [];
          // v2: attributes live visibly on the source line — parse the source,
          // never the rendered DOM (which Dataview and themes may transform)
          const obsidianTask = this.plugin.taskParser.parseAnyTaskFromFileLines(
            sectionLines.slice(lineStartInSection, lineEndsInSection)
          );
          this.plugin.hydrateSyncMappings(obsidianTask);
          const displayParams = displayStates?.get(taskVisualKey(sourcePath,
            sourceLines, mdSectionInfo.lineStart + lineStartInSection));
          if (displayParams) obsidianTask.metadata.taskDisplayParams = { ...displayParams };
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

  function taskVisualKey(sourcePath: string, lines: string[], line: number): string {
    const text = lines[line] ?? '';
    const id = extractBlockId(text).id;
    return JSON.stringify(id ? [sourcePath, 'id', id] : [sourcePath, 'line', line, text]);
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
