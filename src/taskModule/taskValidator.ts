import { logger } from "../utils/log";
import { SettingStore } from '../settings';
import { escapeRegExp } from "../utils/regexUtils";
import { ObsidianTask } from './task';

export class TaskValidator {
    private static formattedMarkdownPattern = /^\s*- \[[^\]]\](.*?)(<span class="[^"]+" style="display:none;">.*?<\/span>)+$/;
    private unformattedMarkdownPattern: RegExp;
    private indicatorTag: string;
    private startingNotation: string;
    private endingNotation: string;

    constructor(settingsStore: typeof SettingStore) {
        // Subscribe to the settings store
        settingsStore.subscribe(settings => {
            this.indicatorTag = escapeRegExp(settings.parsingSettings.indicatorTag);
            this.startingNotation = escapeRegExp(settings.parsingSettings.markdownStartingNotation);
            this.endingNotation = escapeRegExp(settings.parsingSettings.markdownEndingNotation);
        });
        this.unformattedMarkdownPattern = new RegExp(`^\\s*- \\[[\\s*+-x=]\\](.*)(${this.startingNotation}.*?${this.endingNotation})?`);
    }

    private hasIndicatorTag(contentPart: string): boolean {
        const indicatorTagPattern = new RegExp(`#${this.indicatorTag}`);
        return indicatorTagPattern.test(contentPart);
    }

    private getAttributePattern(): RegExp {
        return new RegExp(`${this.startingNotation}.*?${this.endingNotation}`, 'g');
    }

    isValidFormattedTaskMarkdown(taskMarkdown: string): boolean {
        const match = TaskValidator.formattedMarkdownPattern.exec(taskMarkdown);

        if (match && match[1]) {
            const contentWithoutAttributes = match[1].replace(this.getAttributePattern(), '').trim();
            return this.hasIndicatorTag(contentWithoutAttributes);
        }
        return false;
    }

    isValidUnformattedTaskMarkdown(taskMarkdown: string): boolean {
        const match = this.unformattedMarkdownPattern.exec(taskMarkdown);
        if (match && match[1]) {
            const contentWithoutAttributes = match[1].replace(this.getAttributePattern(), '').trim();
            return this.hasIndicatorTag(contentWithoutAttributes);
        }
        return false;
    }

    checkTaskElementSpans(taskElement: HTMLElement): Record<keyof ObsidianTask, HTMLElement | null> {

        const attributes = Object.keys(new ObsidianTask()) as (keyof ObsidianTask)[];

        logger.debug(`taskElement: ${taskElement.innerHTML}, attributes: ${attributes}`);
    
        const spans: Record<keyof ObsidianTask, HTMLElement | null> = {} as any;
    
        for (const attribute of attributes) {
            spans[attribute] = taskElement.querySelector(`span.${attribute}`);
        }
        logger.debug(`${taskElement.innerHTML}`);
    
        return spans;
    }

    isValidTaskElement(taskElement: HTMLElement): boolean {
        const spans = this.checkTaskElementSpans(taskElement);
        return Object.values(spans).some(span => span !== null);
    }

    isCompleteTaskElement(taskElement: HTMLElement): boolean {
        const spans = this.checkTaskElementSpans(taskElement);
        return Object.values(spans).every(span => span !== null);
    }
}

