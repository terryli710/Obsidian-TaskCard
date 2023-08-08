export class TaskValidator {
    // Matches task starting with any number of spaces, followed by "- [any character]", and then any number of span tags
    private static pattern = /^\s*- \[[^\]]\](?: <span class="[^"]+" style="display:none;">.*?<\/span>)*$/;

    static isValidTaskMarkdown(taskMarkdown: string): boolean {
        return this.pattern.test(taskMarkdown);
    }
}