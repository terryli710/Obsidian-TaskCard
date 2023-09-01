import { MarkdownPostProcessorContext, MarkdownSectionInformation } from 'obsidian';
import { ObsidianTask, DocPosition, TextPosition, PositionedObsidianTask, PositionedTaskProperties } from '../taskModule/task';
import TaskCardPlugin from "..";
import { StaticTaskListSvelteAdapter } from "./staticTaskListSvleteAdapter";
import { QueryResult, TaskResult } from "obsidian-dataview/lib/api/plugin-api";
import { MultipleAttributeTaskQuery } from "../query/cache";
import { logger } from "../utils/log";
import { SettingStore } from "../settings";
import { QuerySyncManager } from '../query/querySyncManager';
import { QueryEditorSvelteAdapter } from './queryEditorSvelteAdapter';


export interface MarkdownTaskMetadata {
    originalText: string;
    docPosition: DocPosition;
  }

interface CodeBlockProcessor {
    (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void | Promise<any>;
  }

export class StaticTaskListRenderManager {
      plugin: TaskCardPlugin;
      constructor(plugin: TaskCardPlugin) {
        this.plugin = plugin;
    }

    async extractMarkdownTaskMetadata(queryResult: QueryResult): Promise<MarkdownTaskMetadata[]> {
        const mdTaskMetadataList: MarkdownTaskMetadata[] = [];
      
        for (const task of queryResult.values) {
          const filePath = task.path;
          // const lineNumber = task.line;
          const startPosition: TextPosition = { line: task.position.start.line, col: task.position.start.col };
          const endPosition: TextPosition = { line: task.position.end.line, col: task.position.end.col };
          const originalText = `- [${task.status}] ` + task.text;

          // Use FileOperator to get the original text
          // const originalText = await fileOperator.getLineFromFile(filePath, lineNumber);

          const isValid = this.plugin.taskValidator.isValidFormattedTaskMarkdown(originalText);
          if (!isValid) { continue; }

          if (originalText !== null) {
            const markdownTaskMetadata: MarkdownTaskMetadata = {
              originalText: originalText,
              docPosition: {
                filePath: filePath,
                start: startPosition,
                end: endPosition
              }
            }

            mdTaskMetadataList.push(markdownTaskMetadata);
          }
        }

        return mdTaskMetadataList;
      }


    getCodeBlockProcessor(): CodeBlockProcessor {
        const codeBlockProcessor: CodeBlockProcessor = async (source, el, ctx) => {
          let blockLanguage: string;
          SettingStore.subscribe((settings) => {
            blockLanguage = settings.parsingSettings.blockLanguage;  
          })
          logger.debug(`CodeBlockProcessor: ${source}, ctx: ${JSON.stringify(ctx)}, ctx.getSectionInfo: ${JSON.stringify(ctx.getSectionInfo(el))}`);
          const processor = new QueryEditorSvelteAdapter(this.plugin, blockLanguage, source, el, ctx);
          processor.onload();
          // const exampleFilter: MultipleAttributeTaskQuery = {
          //   // priorityQuery: [1, 2],
          //   // projectQuery: ['CS101', 'HealthPlan'],
          //   // labelQuery: ['#Healthy', '#Family'],
          //   // completedQuery: [false],
          //   // dueDateTimeQuery: ['sep 6', 'sep 9'],
          // }
          // const filteredTasksProps = await this.plugin.cache.taskCache.queryTasks(exampleFilter)
          // const filteredTasks = filteredTasksProps.map((taskProps) => new PositionedObsidianTask(taskProps))
          // const processor = new StaticTaskListSvelteAdapter(this.plugin, el, filteredTasks);
          // processor.onload();
        };
        return codeBlockProcessor;
    }
}