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

    // Extracts list elements (ul and ol) from taskElement
    static extractListEls(taskElement: HTMLElement): HTMLElement[] {
      if (!taskElement) { return []; }

      const listElements: HTMLElement[] = Array.from(taskElement.querySelectorAll('ul, ol'));
      return listElements;
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
        return descriptionMarkdown;
    }

    static progressOfDescription(description: string): [number, number] {
      if (!description || description.trim().length === 0) { return [0, 0]; }
        const taskRegex = /^(?:\s*)-\s\[(.)\]\s.+/gm;
        
        // Initialize counters for total tasks and finished tasks
        let totalTasks = 0;
        let finishedTasks = 0;
        
        // Find all matches
        let match;
        while ((match = taskRegex.exec(description)) !== null) {
            totalTasks++;
            if (match[1] && match[1].trim() !== '') {
                finishedTasks++;
            }
        }
        
        return [finishedTasks, totalTasks];
    }



}