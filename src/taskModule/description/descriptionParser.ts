

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

    static parseDescriptionFromTaskEl(taskElement: HTMLElement): string {
        const ulElement = taskElement.querySelector('ul');
        return htmlToMarkdown(ulElement.outerHTML);
    
    }

    static progressOfDescription(description: string): [number, number] {
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