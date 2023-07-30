import { App, Plugin } from 'obsidian';
import type { PluginManifest } from 'obsidian';
import type { TaskCardSettings } from './settings';
import { DefaultSettings, SettingsTab } from './settings';
import { EmojiPostProcessor } from './renderer/injector';
import { logger } from './log';

export default class TaskCardPlugin extends Plugin {
  public settings: TaskCardSettings;
  // TODO: more properties
  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
    DefaultSettings.subscribe((settings) => {
      logger.info('Settings updated', settings);
      this.settings = settings;
    })
  }

  async onload() {
    this.registerMarkdownPostProcessor(EmojiPostProcessor);
    logger.info('Plugin loaded.');
    console.log('Plugin loaded.');
    this.addSettingTab(new SettingsTab(this.app, this));
  }
}
