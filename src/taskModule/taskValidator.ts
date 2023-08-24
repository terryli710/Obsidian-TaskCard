import { logger } from '../utils/log';
import { SettingStore } from '../settings';
import { escapeRegExp } from '../utils/regexUtils';
import { ObsidianTask } from './task';
import { camelToKebab } from '../utils/stringCaseConverter';

export type SpanElements = Record<keyof ObsidianTask, HTMLElement>;

export class TaskValidator {
  private static formattedMarkdownPattern: RegExp =
    /^\s*- \[[^\]]\](.*?)(<span class="[^"]+" style="display:none;">.*?<\/span>)+{this.markdownSuffix}?$/;
  private spanElementPattern: RegExp =
    /<span class="[^"]+" style="display:none;">(.*?)<\/span>/;
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

  private hasIndicatorTag(contentPart: string): boolean {
    const indicatorTagPattern = new RegExp(`#${this.indicatorTag}`);
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


  private hasSpanElement(markdown: string): boolean {
    if (typeof markdown !== 'string') return false;
  
    const hasSpan = this.spanElementPattern.test(markdown);
  
    return hasSpan;
  }

  isValidFormattedTaskMarkdown(taskMarkdown: string): boolean {
    // at least one span element
    if (!this.hasSpanElement(taskMarkdown)) return false;
    const match = TaskValidator.formattedMarkdownPattern.exec(taskMarkdown);

    if (match && match[1]) {
      const contentWithoutAttributes = match[1]
        .replace(this.getAttributePattern(), '')
        .trim();
      return this.hasIndicatorTag(contentWithoutAttributes);
    }
    return false;
  }

  isValidUnformattedTaskMarkdown(taskMarkdown: string): boolean {
    const match = this.getUnformattedMarkdownPattern().exec(taskMarkdown);
    if (match && match[1]) {
      if (this.hasSpanElement(taskMarkdown)) { return false; }
      const contentWithoutAttributes = match[1]
        .replace(this.getAttributePattern(), '')
        .trim();
      return this.hasIndicatorTag(contentWithoutAttributes);
    }
    return false;
  }

  isMarkdownTaskWithIndicatorTag(taskMarkdown: string): boolean {
    return (
      this.isMarkdownTask(taskMarkdown) && this.hasIndicatorTag(taskMarkdown)
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
    if (!taskElement.querySelector('.task-list-item-checkbox')) {
      return false;
    }

    // Check if the element contains a child with the class 'list-bullet'
    if (!taskElement.querySelector('.list-bullet')) {
      return false;
    }

    // Check indicator tag
    if (!this.checkTaskElementIndicatorTag(taskElement)) {
      return false;
    }

    return true;
  }

  private checkTaskElementIndicatorTag(taskElement: HTMLElement): boolean {
    // Check if the element contains a child with the class 'tag' and the text `#${tagName}`
    const tagElement = taskElement.querySelector('.tag');
    if (
      !tagElement ||
      !tagElement.textContent?.includes(`#${this.indicatorTag}`)
    ) {
      return false;
    }
    return true;
  }

  isValidTaskElement(taskElement: HTMLElement): boolean {
    if (!this.checkTaskElementClass(taskElement)) {
      return false;
    }

    const spans: SpanElements = this.getTaskElementSpans(taskElement);
    return (
      Object.values(spans).length > 0 &&
      Object.values(spans).some((span) => span !== null)
    );
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
