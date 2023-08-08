import { PluginSettingTab, Plugin, App, Setting } from 'obsidian';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import TaskCardPlugin from './index';

export interface TaskCardSettings {
  parsingSettings: any;
  displaySettings: any;
  syncSetting: any; // Todoist account info + other possible synced platforms
  // TODO: some setting values
}

export const DefaultSettings: Writable<TaskCardSettings> =
  writable<TaskCardSettings>({
    parsingSettings: {
      markdownStartingNotation: '%%*',
      markdownEndingNotation: '*%%',
      
    },
    displaySettings: {
      defaultMode: 'single-line',
    },
    syncSetting: {}
  });


export class SettingsTab extends PluginSettingTab {
  private plugin: TaskCardPlugin;
  
  constructor(app: App, plugin: TaskCardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();
    // title
    this.containerEl.createEl('h2', { text: 'Task Card' });
    // display settings
    this.containerEl.createEl('h3', { text: 'Display Settings' });
    this.cardDisplaySettings();
  }

  cardParsingSettings() {

  }

  cardDisplaySettings() {
    new Setting(this.containerEl)
      .setName('Default Display Mode')
      .setDesc('The default display mode when creating a new task card.')
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(
            {
              'Single Line': 'single-line',
              'Multi Line': 'multi-line'
            }
          )
          .setValue(this.plugin.settings.displaySettings.defaultMode);
      });
  }



}