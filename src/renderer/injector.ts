import type {
  MarkdownPostProcessor,
  MarkdownPostProcessorContext
} from 'obsidian';
import { MarkdownRenderChild } from 'obsidian';
import { logger } from '../log';

export class Emoji extends MarkdownRenderChild {
  static ALL_EMOJIS: Record<string, string> = {
    ':+1:': '👍',
    ':sunglasses:': '😎',
    ':smile:': '😄'
  };

  text: string;

  constructor(containerEl: HTMLElement, text: string) {
    super(containerEl);

    this.text = text;
  }

  onload() {
    const emojiEl = this.containerEl.createSpan({
      text: Emoji.ALL_EMOJIS[this.text] ?? this.text
    });
    this.containerEl.replaceWith(emojiEl);
  }
}

export const EmojiPostProcessor: MarkdownPostProcessor = async function (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext
): Promise<void> {
  const codeblocks = el.querySelectorAll('code');
  logger.debug(`codeblocks: ${codeblocks.length}`);

  for (let index = 0; index < codeblocks.length; index++) {
    const codeblock = codeblocks.item(index);
    const text = codeblock.textContent.trim();
    const isEmoji = text[0] === ':' && text[text.length - 1] === ':';
    logger.debug(`text: ${text}, isEmoji: ${isEmoji}`);
    if (isEmoji) {
      ctx.addChild(new Emoji(codeblock, text));
    }
  }
};
