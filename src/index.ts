import { App, Plugin, PluginManifest } from 'obsidian';
import type { TaskCardSettings } from './settings';
import { EmojiPostProcessor } from './renderer/injector';

export default class TaskCardPlugin extends Plugin {
  public settings: TaskCardSettings;
  // TODO: more properties
  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
  }

  async onload() {
    this.registerMarkdownPostProcessor(EmojiPostProcessor);
  }
}
