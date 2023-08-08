import { App, Plugin } from 'obsidian';
import type { PluginManifest } from 'obsidian';
import type { TaskCardSettings } from './settings';
import { SettingStore, SettingsTab } from './settings';
import { TaskCardPostProcessor } from './renderer/injector';
import { logger } from './log';

export default class TaskCardPlugin extends Plugin {
  public settings: TaskCardSettings;
  // TODO: more properties

  
  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
    SettingStore.subscribe((settings) => {
      logger.info('Settings updated', settings);
      this.settings = settings;
    })
  }

  async loadSettings() {
    const loadedSettings = await this.loadData();
    SettingStore.update((old) => {
      return {
        ...old,
        ...(loadedSettings || {}),
      }
    })
  }

  async writeSettings(changeOpts: (settings: TaskCardSettings) => void): Promise<void> {
    SettingStore.update((old) => {
        changeOpts(old);
        return old;
    })
    await this.saveData(this.settings);
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new SettingsTab(this.app, this));
    const taskItemPostProcessor = this.registerMarkdownPostProcessor(TaskCardPostProcessor);
    logger.info('Plugin loaded.');
  }
}
