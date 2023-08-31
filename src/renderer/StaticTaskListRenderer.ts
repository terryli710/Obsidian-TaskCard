import { MarkdownPostProcessorContext } from "obsidian";
import { logger } from "../utils/log";
import { getAPI } from 'obsidian-dataview';
import { FileOperator } from './fileOperator';
import { ObsidianTask } from '../taskModule/task';
import TaskCardPlugin from "..";
import { StaticTaskListSvelteAdapter } from "./staticTaskListSvleteAdapter";
import { QueryResult, TaskResult } from "obsidian-dataview/lib/api/plugin-api";


export interface MarkdownTaskMetadata {
    originalText: string;
    filePath: string;
    lineNumber: number;
    startPosition: { line: number; col: number; offset: number };
    endPosition: { line: number; col: number; offset: number };
  }

interface CodeBlockProcessor {
    (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void | Promise<any>;
  }

export class StaticTaskListRenderManager {
      plugin: TaskCardPlugin;
      constructor(plugin: TaskCardPlugin) {
        this.plugin = plugin;
    }

    async extractMarkdownTaskMetadata(queryResult: QueryResult, fileOperator: FileOperator = this.plugin.fileOperator): Promise<MarkdownTaskMetadata[]> {
        const mdTaskMetadataList: MarkdownTaskMetadata[] = [];
      
        for (const task of queryResult.values) {
          const filePath = task.path;
          const lineNumber = task.line;
          const startPosition = task.position.start;
          const endPosition = task.position.end;
          const originalText = `- [${task.status}] ` + task.text;
      
          // Use FileOperator to get the original text
          // const originalText = await fileOperator.getLineFromFile(filePath, lineNumber);

          const isValid = this.plugin.taskValidator.isValidFormattedTaskMarkdown(originalText);
          console.log(`isValid: ${isValid} for originalText: ${originalText}`);
          if (!isValid) { continue; }
      
          if (originalText !== null) {
            const markdownTaskMetadata: MarkdownTaskMetadata = {
              originalText,
              filePath,
              lineNumber,
              startPosition,
              endPosition,
            }
      
            mdTaskMetadataList.push(markdownTaskMetadata);
          }
        }
      
        return mdTaskMetadataList;
      }


    getCodeBlockProcessor(): CodeBlockProcessor {
        const codeBlockProcessor: CodeBlockProcessor = async (source, el, ctx) => {
          logger.debug(`source: ${source}`);
            const api = getAPI();
            const query: QueryResult = await api.tryQuery(source);
            logger.debug(`query: ${JSON.stringify(query)}`);
            const mdTaskMetadataList = await this.extractMarkdownTaskMetadata(query);
            let taskListInfo: {task: ObsidianTask, markdownTaskMetadata: MarkdownTaskMetadata}[] = [];
            for (const markdownTaskMetadata of mdTaskMetadataList) {
              const task = this.plugin.taskParser.parseFormattedTaskMarkdown(markdownTaskMetadata.originalText);
              taskListInfo.push({task, markdownTaskMetadata});
            }
            const processor = new StaticTaskListSvelteAdapter(this.plugin, el, taskListInfo);
            processor.onload();
        };
        return codeBlockProcessor;
    }
}