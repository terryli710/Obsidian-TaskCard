
export type SuggestInformation = {
    displayText: string, // text to display to the user
    replaceText: string, // text to replace the original file
    replaceFrom: number, // where to replace from in a line.
    replaceTo: number, // where to replace to in a line.
    cursorPosition: number, // the new cursor position in the line.
    innerHTML?: string // the innerHTML of the suggestion
}