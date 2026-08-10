import { logger } from '../utils/log';
import { SettingStore } from '../settings';
import { escapeRegExp } from '../utils/regexUtils';
import { ObsidianTask } from './task';
import { camelToKebab } from '../utils/stringCaseConverter';

export type SpanElements = Record<keyof ObsidianTask, HTMLElement>;

export function isMarkdownTaskLine(taskMarkdown: string): boolean {
  return /^\s*- \[[^\]]\]\s/.test(taskMarkdown);
}

export function isTaskCardTaskLine(
  taskMarkdown: string,
  indicatorTag: string
): boolean {
  if (typeof taskMarkdown !== 'string') return false;
  if (!isMarkdownTaskLine(taskMarkdown)) return false;
  const tagPattern = new RegExp(
    `#${escapeRegExp(indicatorTag)}(?![A-Za-z0-9_/-])`
  );
  return tagPattern.test(taskMarkdown.split('\n', 1)[0]);
}

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
      // Stored raw (not pre-escaped): callers that build their own RegExp
      // from this.indicatorTag are responsible for escaping it themselves —
      // isTaskCardTaskMarkdown delegates to isTaskCardTaskLine, which already
      // escapes internally, so pre-escaping here would double-escape any
      // indicator tag containing a regex metacharacter.
      this.indicatorTag = settings.parsingSettings.indicatorTag;
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
    const indicatorTagPattern = new RegExp(`#${escapeRegExp(indicatorTag)}`);
    return indicatorTagPattern.test(contentPart);
  }

  isMarkdownTask(taskMarkdown: string): boolean {
    return isMarkdownTaskLine(taskMarkdown);
  }

  /**
   * v2 detection: any markdown task line carrying the indicator tag is a
   * TaskCard task, whatever dialect its attributes are written in (v2 fields,
   * Tasks emoji, legacy `%%*` / hidden span). The tag must be a whole tag
   * token, not a prefix of a longer tag.
   */
  isTaskCardTaskMarkdown(taskMarkdown: string, indicatorTag: string | null = null): boolean {
    return isTaskCardTaskLine(
      taskMarkdown,
      indicatorTag === null ? this.indicatorTag : indicatorTag
    );
  }

  /** Whether the line already carries a trailing block id (v2 identity). */
  hasBlockId(taskMarkdown: string): boolean {
    return /\s\^[A-Za-z0-9-]+\s*$/.test(taskMarkdown.split('\n', 1)[0]);
  }

  /** Legacy v1 notations that a rewrite should migrate away from. */
  hasLegacyNotation(taskMarkdown: string): boolean {
    if (typeof taskMarkdown !== 'string') return false;
    const line = taskMarkdown.split('\n', 1)[0];
    if (this.hasSpanElement(line)) return true;
    const legacyAttrPattern = new RegExp(
      `${this.startingNotation}.*?${this.endingNotation}`
    );
    return legacyAttrPattern.test(line);
  }

  private getAttributePattern(): RegExp {
    return new RegExp(`${this.startingNotation}.*?${this.endingNotation}`, 'g');
  }

  private getUnformattedMarkdownPattern(): RegExp {
    const markdownPatternText: string = `^\\s*- \\[[\\s*+-x=]\\] (.*)(${this.startingNotation}[a-zA-Z]+:\\s*.*?${this.endingNotation}\\s*)*(${this.markdownSuffix})?`;
    return new RegExp(markdownPatternText, 'gm');
  }

  private getFormattedMarkdownPattern(): RegExp {
    const markdownSuffix = this.markdownSuffix;
    return new RegExp(`^\\s*- \\[[^\\]]\\] (.*?)\\s*(<span( class="[^"]+")? style="display:none">\\{.*?\\}<\\/span>)\\s*(${markdownSuffix})?`);
  }

  // private getExtractedFormattedMarkdownPattern(): RegExp {
  //   return new RegExp(`^\\s*- \\[[^\\]]\\] (.*?)\\s*\\{.*?\\}<\\/span>\\s*(${this.markdownSuffix})?`, 'gm');
  // }

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

  // isValidExtractedFormattedTaskMarkdown(taskMarkdown: string, indicatorTag: string | null  = null): boolean {
  //   const match = this.getExtractedFormattedMarkdownPattern().exec(taskMarkdown);
  //   if (match && match[1]) {
  //     const contentWithoutAttributes = match[1]
  //       .replace(this.getAttributePattern(), '')
  //       .trim();
  //     return this.hasIndicatorTag(contentWithoutAttributes, indicatorTag);
  //   }
  //   return false;
  // }

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
    // v2: a rendered task item qualifies by carrying the indicator tag and a
    // checkbox — no hidden span required (attributes are parsed from the
    // source line, not the DOM)
    if (!taskElement.querySelector('.task-list-item-checkbox')) return false;

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
