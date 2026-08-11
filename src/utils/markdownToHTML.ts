import { logger } from "./log";


import showdown from 'showdown';

export function markdownToHTML(markdown: string) {
    const converter = new showdown.Converter();
    const html = converter.makeHtml(markdown);
    logger.debug(`markdown: ${markdown}`);
    logger.debug(`html: ${html}`);
    return html;

}


