import { MarkdownPostProcessorContext } from "obsidian";



interface CodeBlockProcessor {
    (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void | Promise<any>;
  }

export class StaticTaskListRenderManager {

    constructor() {
        
    }


    getCodeBlockProcessor(): CodeBlockProcessor {
        return (source, el, ctx) => {
            el.innerHTML = `<strong>${source}</strong>`;
        };
    }
}