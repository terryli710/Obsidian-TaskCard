
import { camelToKebab, kebabToCamel } from '../../utils/stringCaseConverter';

export class LabelModule {
    private labels: string[];

    constructor() {
        this.labels = [];
    }

    // Check if a label is valid based on Obsidian's rules
    private isValidLabel(label: string): boolean {
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
        label = label.trim();
        if (!this.isValidLabel(label)) {
            // Convert to camelCase if the label is invalid
            label = kebabToCamel(camelToKebab(label));
        }
        return label;
    }

    // Add a label to the labels list
    public addLabel(label: string, strict: boolean = true): void {
        const validatedLabel = this.validateLabel(label);
        if (!this.isValidLabel(validatedLabel)) {
            if (strict) throw new Error('Invalid label format');
            return;
        }
        if (!this.labels.includes(validatedLabel)) {
            this.labels.push(validatedLabel);
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
        return this.labels;
    }

    // Set the list of labels
    public setLabels(labels: string[]): void {
        this.labels = labels.map(label => this.validateLabel(label)).filter(label => this.isValidLabel(label));
    }

    // Edit an existing label
    public editLabel(newLabel: string, oldLabel: string): void {
        const index = this.labels.indexOf(oldLabel);
        if (index === -1) throw new Error('Label not found');
        const validatedLabel = this.validateLabel(newLabel);
        if (!this.isValidLabel(validatedLabel)) throw new Error('Invalid new label format');
        this.labels[index] = validatedLabel;
    }

    // Delete a label from the labels list
    public deleteLabel(label: string): void {
        const index = this.labels.indexOf(label);
        if (index === -1) throw new Error('Label not found');
        this.labels.splice(index, 1);
    }
}
