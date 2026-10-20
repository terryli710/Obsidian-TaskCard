import { logger } from '../../utils/log';
import { toCamelCase } from '../../utils/stringCaseConverter';
import { TAG_CHAR, tagPattern } from '../../utils/regexUtils';

const nativeTagCharacter = new RegExp(`^${TAG_CHAR}$`, 'u');

export class LabelModule {
  private labels: string[];

  constructor() {
    this.labels = [];
  }

  // Check if a label is valid based on Obsidian's rules
  public isValidLabel(label: string): boolean {
    if (!label || /^[0-9]+$/.test(label)) return false;
    const token = `#${label}`;
    return tagPattern().exec(token)?.[0] === token;
  }

  // Validate and possibly format a label
  public validateLabel(label: string): string {
    // Remove symbols not accepted in a label, replace with space
    label = label.replace(/\S/gu, character => nativeTagCharacter.test(character) ? character : ' ');
    // Trim consecutive spaces to one, trim start and end spaces
    label = label.replace(/\s+/g, ' ').trim();
    // Convert to camelCase if not strict
    return toCamelCase(label);
  }

  // Add a label to the labels list
  public addLabel(label: string, strict: boolean = true): void {
    label = label.replace(/^#+/, ''); // Remove leading "#"

    if (!this.isValidLabel(label)) {
      if (strict) {
        logger.error('Invalid label format');
      } else {
        const validLabel = this.validateLabel(label);
        if (!this.isValidLabel(validLabel)) {
          logger.error('Invalid label format');
        } else {
          this.pushLabel(validLabel);
        }
      }
    } else {
      this.pushLabel(label);
    }
  }

  private pushLabel(label: string): void {
    if (!this.labels.some(existing => existing.toLowerCase() === label.toLowerCase())) {
      this.labels.push(label);
    }
  }

  // Add multiple labels to the labels list
  public addLabels(labels: string[], strict: boolean = true): void {
    for (const label of labels) {
      this.addLabel(label, strict);
    }
  }

  // Get the list of labels
  public getLabels(): string[] {
    return this.labels.map((label) => '#' + label); // Add "#" at the start
  }

  // Set the list of labels
  public setLabels(labels: string[], strict: boolean = true): void {
    this.deleteAllLabels();
    this.addLabels(labels, strict);
  }

  // Edit an existing label
  public editLabel(
    newLabel: string,
    oldLabel: string,
    strict: boolean = true
  ): void {
    oldLabel = oldLabel.replace(/^#+/, ''); // Remove leading "#"
    const index = this.labels.findIndex(label => label.toLowerCase() === oldLabel.toLowerCase());
    if (index === -1) throw new Error('Label not found');

    newLabel = newLabel.replace(/^#+/, ''); // Remove leading "#"

    if (!this.isValidLabel(newLabel)) {
      if (strict) {
        logger.error('Invalid new label format');
      } else {
        const validLabel = this.validateLabel(newLabel);
        if (!this.isValidLabel(validLabel)) {
          logger.error('Invalid new label format');
        } else {
          this.replaceLabel(index, validLabel);
        }
      }
    } else {
      this.replaceLabel(index, newLabel);
    }
  }

  private replaceLabel(index: number, label: string): void {
    const duplicate = this.labels.some((existing, existingIndex) =>
      existingIndex !== index && existing.toLowerCase() === label.toLowerCase());
    if (duplicate) {
      this.labels.splice(index, 1);
    } else {
      this.labels[index] = label;
    }
  }

  // Delete a label from the labels list
  public deleteLabel(label: string): void {
    label = label.replace(/^#+/, ''); // Remove leading "#"
    const index = this.labels.findIndex(existing => existing.toLowerCase() === label.toLowerCase());
    if (index === -1) throw new Error('Label not found');
    this.labels.splice(index, 1);
  }

  private deleteAllLabels(): void {
    this.labels = [];
  }
}
