import { MarkdownPostProcessorContext } from "obsidian";
import { logger } from "../utils/log";
import { getAPI } from 'obsidian-dataview';
import { FileOperator } from './fileOperator';


interface MarkdownTaskMetadata {
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
    fileOperator: FileOperator
    constructor(fileOperator: FileOperator) {
        this.fileOperator = fileOperator
    }

    async extractMarkdownTaskMetadata(queryResult: any, fileOperator: FileOperator = this.fileOperator): Promise<MarkdownTaskMetadata[]> {
        const mdTaskMetadataList: MarkdownTaskMetadata[] = [];
      
        for (const task of queryResult.values) {
          const filePath = task.path;
          const lineNumber = task.line;
          const startPosition = task.position.start;
          const endPosition = task.position.end;
      
          // Use FileOperator to get the original text
          const originalText = await fileOperator.getLineFromFile(filePath, lineNumber);
      
          if (originalText !== null) {
            const markdownTaskMetadata: MarkdownTaskMetadata = {
              originalText,
              filePath,
              lineNumber,
              startPosition,
              endPosition,
            };
      
            mdTaskMetadataList.push(markdownTaskMetadata);
          }
        }
      
        return mdTaskMetadataList;
      }


    getCodeBlockProcessor(): CodeBlockProcessor {
        return async (source, el, ctx) => {
            const api = getAPI();
            // const markdown = await api.markdownTaskList(
            //     api.pages('#TaskCard').file.tasks
            //     .where((task) => !task.completed)
            //     .where((task) => task.text.includes('#TaskCard'))
            //     .where((task) => task.text.includes('#Family'))
            // );
            // logger.debug(`markdown: ${markdown}`);

            const query = await api.tryQuery('TASK FROM #TaskCard WHERE !completed AND contains(text, "#TaskCard") AND contains(text, "#Family")');
            const mdTaskMetadataList = await this.extractMarkdownTaskMetadata(query);
            el.innerHTML = `<strong>${JSON.stringify(JSON.stringify(mdTaskMetadataList))}</strong>`;
        };
    }
}