import { MarkdownPostProcessorContext } from 'obsidian';
import { DocPosition, TextPosition } from '../taskModule/task';
import TaskCardPlugin from "..";
import { QueryResult } from "obsidian-dataview/lib/api/plugin-api";
import { logger } from "../utils/log";
import { SettingStore } from "../settings";
import { QueryAndTaskListSvelteAdapter } from './queryAndTaskListSvelteAdapter';


export interface MarkdownTaskMetadata {
    originalText: string;
    docPosition: DocPosition;
  }

export interface CodeBlockProcessor {
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
          const processor = new QueryAndTaskListSvelteAdapter(this.plugin, blockLanguage, source, el, ctx);
          processor.onload();
        };
        return codeBlockProcessor;
    }
}