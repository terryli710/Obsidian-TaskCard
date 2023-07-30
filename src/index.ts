import { App, Plugin } from 'obsidian';
import type { PluginManifest } from 'obsidian';
import type { TaskCardSettings } from './settings';
import { DefaultSettings } from './settings';
import { EmojiPostProcessor } from './renderer/injector';
import { logger } from './log';

export default class TaskCardPlugin extends Plugin {
  public settings: TaskCardSettings;
  // TODO: more properties
  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
    DefaultSettings.subscribe((settings) => {
      logger.debug('Settings updated', settings);
      this.settings = settings;
    })
  }

  async onload() {
    this.registerMarkdownPostProcessor(EmojiPostProcessor);
  }
}
