import { logger } from "../../utils/log";


// Fallback function to replace htmlToMarkdown from Obsidian
const fallbackHtmlToMarkdown = (html: string): string => {
    // Your fallback implementation here
    return html; // For now, just returning the same HTML
  };
  
  let htmlToMarkdown: (html: string) => string;
  
  try {
    // Try importing Obsidian's htmlToMarkdown
    const obsidian = require('obsidian');
    htmlToMarkdown = obsidian.htmlToMarkdown;
  } catch (error) {
    // If Obsidian package is not found, use the fallback function
    console.warn("Obsidian package not found. Using fallback function for htmlToMarkdown.");
    htmlToMarkdown = fallbackHtmlToMarkdown;
}

export class DescriptionParser {
    constructor() {
    }

    // Extracts top-level list elements (ul and ol) from taskElement.
    // Nested lists are serialized as part of their parent list, so returning
    // them as well would duplicate their items in the description.
    static extractListEls(taskElement: HTMLElement): HTMLElement[] {
      if (!taskElement) { return []; }

      const listElements: HTMLElement[] = Array.from(
        taskElement.querySelectorAll('ul, ol')
      );
      return listElements.filter((el) => {
        const enclosingList = el.parentElement?.closest('ul, ol');
        return !enclosingList || !taskElement.contains(enclosingList);
      });
  }

  // Parses the description from a given task element
    static parseDescriptionFromTaskEl(taskElement: HTMLElement): string {
        const listElements = DescriptionParser.extractListEls(taskElement);
        if (listElements.length === 0) { return ""; }
        let descriptionMarkdown = "";

        for (const listEl of listElements) {
            try {
                descriptionMarkdown += htmlToMarkdown(listEl.outerHTML) + "\n";
            } catch (error) {
                throw new Error(`Failed to convert HTML to Markdown: ${error.message}`);
            }
        }
        // strip the trailing separator newline: a description ending in "\n"
        // makes the formatter emit a dangling indented blank line below the
        // task, which sits outside the task's write span and so accumulates
        // one extra line on every card edit
        return descriptionMarkdown.replace(/\n+$/, '');
    }

    static progressOfDescription(description: string): [number, number] {
      if (!description || description.trim().length === 0) { return [0, 0]; }
        // [ \t] instead of \s after the marker: \s matches newlines, which made
        // a bare "- [ ]" checkbox swallow (and hide) the following line
        const taskRegex = /^[ \t]*-\s\[(.)\][ \t]*.*$/gm;
        
        // Initialize counters for total tasks and finished tasks
        let totalTasks = 0;
        let finishedTasks = 0;
        
        // Find all matches
        let match;
        while ((match = taskRegex.exec(description)) !== null) {
            totalTasks++;
            // only [x]/[X] count as finished; other markers ([-], [/], [?]) do not
            if (match[1] && match[1].toLowerCase() === 'x') {
                finishedTasks++;
            }
        }
        
        return [finishedTasks, totalTasks];
    }



}