import { logger } from "./log";


var showdown = require('showdown');

export function markdownToHTML(markdown: string) {
    const converter = new showdown.Converter();
    const html = converter.makeHtml(markdown);
    logger.debug(`markdown: ${markdown}`);
    logger.debug(`html: ${html}`);
    return html;

}


