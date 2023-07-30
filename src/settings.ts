import { PluginSettingTab, Plugin, App } from 'obsidian';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import TaskCardPlugin from './index';

export interface TaskCardSettings {
  syncSetting: any; // Todoist account info + other possible synced platforms
  // TODO: some setting values
}

export const DefaultSettings: Writable<TaskCardSettings> =
  writable<TaskCardSettings>({
    syncSetting: {}
  });


export class SettingsTab extends PluginSettingTab {
  private plugin: TaskCardPlugin;
  
  constructor(app: App, plugin: TaskCardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {

  }
}