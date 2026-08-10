import { logger } from '../../utils/log';
import { toCamelCase } from '../../utils/stringCaseConverter';

export class LabelModule {
  private labels: string[];

  constructor() {
    this.labels = [];
  }

  // Check if a label is valid based on Obsidian's rules
  public isValidLabel(label: string): boolean {
    // The label should not be empty
    if (!label) return false;
    // The label should contain at least one non-numerical character
    if (!/[A-Za-z_\-\/]/.test(label)) return false;
    // The label should not contain spaces
    if (/\s/.test(label)) return false;
    return true;
  }

  // Validate and possibly format a label
  public validateLabel(label: string): string {
    // Remove symbols not accepted in a label, replace with space
    label = label.replace(/[^A-Za-z0-9_\-\/\s]/g, ' ');
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
    if (!this.labels.includes(label)) {
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
    const index = this.labels.indexOf(oldLabel);
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
          this.labels[index] = validLabel;
        }
      }
    } else {
      this.labels[index] = newLabel;
    }
  }

  // Delete a label from the labels list
  public deleteLabel(label: string): void {
    label = label.replace(/^#+/, ''); // Remove leading "#"
    const index = this.labels.indexOf(label);
    if (index === -1) throw new Error('Label not found');
    this.labels.splice(index, 1);
  }

  private deleteAllLabels(): void {
    this.labels = [];
  }
}
