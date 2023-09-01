import { MarkdownPostProcessorContext } from "obsidian";
import { logger } from "../utils/log";
import { getAPI } from 'obsidian-dataview';
import { FileOperator } from './fileOperator';
import { ObsidianTask, DocPosition, TextPosition, PositionedObsidianTask, PositionedTaskProperties } from '../taskModule/task';
import TaskCardPlugin from "..";
import { StaticTaskListSvelteAdapter } from "./staticTaskListSvleteAdapter";
import { QueryResult, TaskResult } from "obsidian-dataview/lib/api/plugin-api";


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

          let filteredTasksProps: PositionedTaskProperties[] = [];
            // TODO: source can somehow becomes a function for filtering the task
            function demoFilter(positionedObsidianTask: PositionedObsidianTask): boolean {
                // if task has due and has tag Family
                if (positionedObsidianTask.hasDue() && positionedObsidianTask.labels.contains('#Family')) {
                    return true;
                }
                return false;
            }

            const handleFilteredTasks = (err: Error, rows: PositionedTaskProperties[]): void => {
              if (err) {
                  console.error('An error occurred:', err);
                  return;
              }
            
              filteredTasksProps = rows;
            };

            const filteredTasks: PositionedObsidianTask[] = filteredTasksProps.map(taskProps => new PositionedObsidianTask(taskProps));

            this.plugin.cache.taskCache.database.filterWithFunction('', demoFilter, handleFilteredTasks);
            const processor = new StaticTaskListSvelteAdapter(this.plugin, el, filteredTasks);
            processor.onload();
        };
        return codeBlockProcessor;
    }
}