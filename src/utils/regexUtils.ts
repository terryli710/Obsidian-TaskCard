import { logger } from "../log";


export function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');  // $& means the whole matched string
}


export function extractTags(text: string): [string[], string] {
    // Regular expression to detect valid tags based on the provided rules
    const tagRegex = /#([a-zA-Z_/-]+[a-zA-Z0-9_/-]*|[a-zA-Z_/-][a-zA-Z0-9_/-]+)/g;
    let matches = text.match(tagRegex) || [];
    
    // Remove the tags from the content and then trim any consecutive spaces greater than 2
    const remainingText = text.replace(/(\s?)#([a-zA-Z_/-]+[a-zA-Z0-9_/-]*|[a-zA-Z_/-][a-zA-Z0-9_/-]+)(\s?)/g, ' ').trim();

    return [matches, remainingText];
}