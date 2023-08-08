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

export const DefaultSettings: TaskCardSettings = {
  parsingSettings: {
    markdownStartingNotation: '%%*',
    markdownEndingNotation: '*%%',
    indicatorTag: 'TaskCard',
  },
  displaySettings: {
    defaultMode: 'single-line',
  },
  syncSetting: {}
}

export const SettingStore: Writable<TaskCardSettings> = writable<TaskCardSettings>(DefaultSettings);


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
    // parsing settings
    this.containerEl.createEl('h3', { text: 'Parsing Settings' });
    this.cardParsingSettings();
    // display settings
    this.containerEl.createEl('h3', { text: 'Display Settings' });
    this.cardDisplaySettings();
  }

  cardParsingSettings() {
    let textField: any;

    new Setting(this.containerEl)
        .setName('Indicator Tag')
        .setDesc('The tag used to identify task cards.')
        .addText(text => {
            textField = text;
            return text
                .setPlaceholder('YourTagHere')
                .setValue(this.plugin.settings.parsingSettings.indicatorTag)
                .onChange(async (value: string) => {
                    // remove all the leading # from the value
                    const indicatorTag = value.replace(/^#/, '');
                    this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = indicatorTag));
                });
        })
        .addButton(button => {
            button.setButtonText("Reset")
                .onClick(async () => {
                    this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = DefaultSettings.parsingSettings.indicatorTag));
                });
        });
}


  cardDisplaySettings() {
    new Setting(this.containerEl)
      .setName('Default Display Mode')
      .setDesc('The default display mode when creating a new task card.')
      .addDropdown((dropdown) => {
        dropdown
          .addOptions({
              'Single Line': 'single-line',
              'Multi Line': 'multi-line'
          })
          .setValue(this.plugin.settings.displaySettings.defaultMode)
          .onChange(async (value: string) => {
              await this.plugin.writeSettings((old) => (old.displaySettings.defaultMode = value));
          });
      });
  }



}