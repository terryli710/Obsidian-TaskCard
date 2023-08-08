// validator checks if the input text is a valid task 

import { logger } from "../log";

export class TaskValidator {
    // Matches task starting with any number of spaces, followed by "- [any character]", and then any number of span tags
    private static formattedMarkdownPattern = /^\s*- \[[^\]]\](.*?)(?: <span class="[^"]+" style="display:none;">.*?<\/span>)*$/;
    private static unformattedMarkdownPattern = /^\s*- \[[^\]]\](.*)%%\*.*?\*%%/;

    private static hasIndicatorTag(contentPart: string, indicatorTag: string): boolean {
        const indicatorTagPattern = new RegExp(`#${indicatorTag}`);
        return indicatorTagPattern.test(contentPart);
    }
    
    static isValidFormattedTaskMarkdown(taskMarkdown: string, indicatorTag: string): boolean {
        const match = this.formattedMarkdownPattern.exec(taskMarkdown);
        logger.debug(`Matched: ${match}, indicatorTag: ${indicatorTag}`);
        if (match && match[1]) {
            return this.hasIndicatorTag(match[1], indicatorTag);
        }
        return false;
    }
    
    static isValidUnformattedTaskMarkdown(taskMarkdown: string, indicatorTag: string): boolean {
        const match = this.unformattedMarkdownPattern.exec(taskMarkdown);
        if (match && match[1]) {
            return this.hasIndicatorTag(match[1], indicatorTag);
        }
        return false;
    }
}