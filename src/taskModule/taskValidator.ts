import { logger } from '../utils/log';
import { SettingStore } from '../settings';
import { escapeRegExp } from '../utils/regexUtils';
import { ObsidianTask } from './task';
import { camelToKebab } from '../utils/stringCaseConverter';

export type SpanElements = Record<keyof ObsidianTask, HTMLElement>;

export class TaskValidator {
  private spanElementPattern: RegExp =
    /<span( class="[^"]+")? style="display:none">(.*?)<\/span>/;
  private markdownTaskPattern: RegExp = /^\s*- \[[^\]]\]\s/;
  private indicatorTag: string;
  private startingNotation: string;
  private endingNotation: string;
  private markdownSuffix: string;

  constructor(settingsStore: typeof SettingStore) {
    // Subscribe to the settings store
    settingsStore.subscribe((settings) => {
      this.indicatorTag = escapeRegExp(settings.parsingSettings.indicatorTag);
      this.startingNotation = escapeRegExp(
        settings.parsingSettings.markdownStartingNotation
      );
      this.endingNotation = escapeRegExp(
        settings.parsingSettings.markdownEndingNotation
      );
      this.markdownSuffix = escapeRegExp(
        settings.parsingSettings.markdownSuffix
      );
    });
  }

  private hasIndicatorTag(contentPart: string, indicatorTag: string | null = null): boolean {
    if (typeof contentPart !== 'string') return false;
    if (indicatorTag === null) { indicatorTag = this.indicatorTag; }
    const indicatorTagPattern = new RegExp(`#${indicatorTag}`);
    return indicatorTagPattern.test(contentPart);
  }

  isMarkdownTask(taskMarkdown: string): boolean {
    return this.markdownTaskPattern.test(taskMarkdown);
  }

  private getAttributePattern(): RegExp {
    return new RegExp(`${this.startingNotation}.*?${this.endingNotation}`, 'g');
  }

  private getUnformattedMarkdownPattern(): RegExp {
    const markdownPatternText: string = `^\\s*- \\[[\\s*+-x=]\\] (.*)(${this.startingNotation}[a-zA-Z]+:\\s*.*?${this.endingNotation}\\s*)*(${this.markdownSuffix})?$`;
    return new RegExp(markdownPatternText, 'gm');
  }

  private getFormattedMarkdownPattern(): RegExp {
    const markdownSuffix = this.markdownSuffix;
    return new RegExp(`^\\s*- \\[[^\\]]\\] (.*?)\\s*(<span( class="[^"]+")? style="display:none">\\{.*?\\}<\\/span>)\\s*(${markdownSuffix})?$`);
  }


  private hasSpanElement(markdown: string): boolean {
    if (typeof markdown !== 'string') return false;
  
    const hasSpan = this.spanElementPattern.test(markdown);
    return hasSpan;
  }

  isValidFormattedTaskMarkdown(taskMarkdown: string, indicatorTag: string | null  = null): boolean {
    // Check for a single span element with or without class, containing an object of attributes
    const singleSpanPattern = /<span(?: class="[^"]+")? style="display:none">\{.*?\}<\/span>/;
    if (!singleSpanPattern.test(taskMarkdown)) return false;

    const match = this.getFormattedMarkdownPattern().exec(taskMarkdown);
    if (match && match[1]) {
      const contentWithoutAttributes = match[1]
        .replace(this.getAttributePattern(), '')
        .trim();
      return this.hasIndicatorTag(contentWithoutAttributes, indicatorTag);
    }
    return false;
  }

  selectHiddenSpans(taskEl: HTMLElement): HTMLElement[] | null {
    // Get all span elements
    const allSpans = taskEl.querySelectorAll('span');

    // Filter those that have 'display:none' in their style attribute
    const hiddenSpans = Array.from(allSpans).filter(span => {
      const style = span.getAttribute('style');
      return style && style.replace(/\s/g, '').includes('display:none');
    });

    return hiddenSpans;
  }

  isValidTaskElement(taskElement: HTMLElement): boolean {
    // Check for a single span element with or without class, containing an object of attributes
    const hiddenSpans = this.selectHiddenSpans(taskElement);
    if (hiddenSpans.length === 0) { return false; }
    const singleSpanElement = hiddenSpans[0];
    if (!singleSpanElement || !/^\{.*\}$/.test(singleSpanElement.textContent || '')) {
      return false;
    }

    // Check for the presence of the indicator tag
    return this.checkTaskElementIndicatorTag(taskElement);
  }

  isValidUnformattedTaskMarkdown(taskMarkdown: string, indicatorTag: string | null  = null): boolean {
    const match = this.getUnformattedMarkdownPattern().exec(taskMarkdown);
    if (match && match[1]) {
      if (this.hasSpanElement(taskMarkdown)) { return false; }
      const contentWithoutAttributes = match[1]
        .replace(this.getAttributePattern(), '')
        .trim();
      return this.hasIndicatorTag(contentWithoutAttributes, indicatorTag);
    }
    return false;
  }

  isMarkdownTaskWithIndicatorTag(taskMarkdown: string, indicatorTag: string | null  = null): boolean {
    return (
      this.isMarkdownTask(taskMarkdown) && this.hasIndicatorTag(taskMarkdown, indicatorTag)
    );
  }

  private getTaskElAttributeNames(): string[] {
    const exemptAttributes: string[] = ['content', 'completed'];
    const attributes = Object.keys(
      new ObsidianTask()
    ) as (keyof ObsidianTask)[];
    return attributes.filter((attr) => !exemptAttributes.includes(attr));
  }

  private getTaskElementSpans(taskElement: HTMLElement): SpanElements {
    const attributes = this.getTaskElAttributeNames().map((attr) =>
      camelToKebab(attr)
    );

    return attributes.reduce((acc: Partial<SpanElements>, attribute) => {
      const spanElement: HTMLElement = taskElement.querySelector(
        `span.${attribute}`
      );
      if (spanElement) {
        acc[attribute] = spanElement;
      }
      return acc;
    }, {}) as SpanElements;
  }

  private checkTaskElementClass(taskElement: HTMLElement): boolean {
    // Check if the element contains a child with the class 'task-list-item-checkbox'
    if (!taskElement.querySelector('.task-list-item-checkbox')) return false;

    // Check if the element contains a child with the class 'list-bullet'
    if (!taskElement.querySelector('.list-bullet')) return false;

    // Check indicator tag
    if (!this.checkTaskElementIndicatorTag(taskElement)) return false;

    return true;
  }

  private checkTaskElementIndicatorTag(taskElement: HTMLElement): boolean {
    // Find all elements with the class 'tag'
    const tagElements = taskElement.querySelectorAll('.tag');
    
    // Loop through each tag element to see if it contains the indicator tag
    for (const tagElement of tagElements) {
      if (tagElement.textContent?.includes(`#${this.indicatorTag}`)) {
        return true; // Found the indicator tag, so return true
      }
    }
    
    // If the loop completes without finding the indicator tag, return false
    return false;
  }


  isCompleteTaskElement(taskElement: HTMLElement): boolean {
    if (!this.checkTaskElementClass(taskElement)) {
      return false;
    }

    const spans: SpanElements = this.getTaskElementSpans(taskElement);
    const attributes = this.getTaskElAttributeNames().map((attr) =>
      camelToKebab(attr)
    );
    return attributes.every(
      (attr) => spans[attr] !== undefined && spans[attr] !== null
    );
  }
}
