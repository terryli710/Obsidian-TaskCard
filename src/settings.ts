import { PluginSettingTab, Plugin, App, Setting } from 'obsidian';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import TaskCardPlugin from './index';

export interface TaskCardSettings {
  parsingSettings: {
    markdownStartingNotation: string;
    markdownEndingNotation: string;
    indicatorTag: string;
  };
  displaySettings: {
    defaultMode: string;
  };
  userMetadata: {
    projects: any;
  };
  syncSettings: any; // Todoist account info + other possible synced platforms
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
  userMetadata: {
    projects: {},
  },
  syncSettings: {},
};

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
    // projects
    this.containerEl.createEl('h3', { text: 'Projects' });
    this.projectSettings();
    // parsing settings
    this.containerEl.createEl('h3', { text: 'Parsing Settings' });
    this.cardParsingSettings();
    // display settings
    this.containerEl.createEl('h3', { text: 'Display Settings' });
    this.cardDisplaySettings();
  }

  projectSettings() {
    // Fetch the projects from the projectModule
    const projects = this.plugin.projectModule.getProjectsData();

    // Display existing projects
    for (const project of projects) {
        // Create a container for each project
        const projectContainer = this.containerEl.createEl('div', { cls: 'project-container' });

        // Display project name with an option to edit
        new Setting(projectContainer)
            .setName('Project Name')
            .addText(text => text
                .setValue(project.name)
                .onChange(async (value: string) => {
                    this.plugin.projectModule.updateProject({ id: project.id, name: value });
                    this.updateProjectsToSettings();
                })
            );

        // Placeholder for future color implementation
        // TODO: Implement color picker when available

        // Option to delete the project
        new Setting(projectContainer)
            .addButton(button => button
                .setButtonText("Delete")
                .onClick(async () => {
                    // Assuming null name means delete
                    // Instead of setting the name to null, we'll remove the project from the map directly
                    this.plugin.projectModule.deleteProjectById(project.id);
                    this.updateProjectsToSettings();
                    projectContainer.remove();  // Remove the project from the UI
                })
            );
    }

    // Add new project
    const newProjectContainer = this.containerEl.createEl('div', { cls: 'new-project-container' });
    let newProjectName = '';

    new Setting(newProjectContainer)
        .setName('New Project Name')
        .addText(text => text
            .setPlaceholder('Enter project name')
            .onChange(value => newProjectName = value)
        );

    new Setting(newProjectContainer)
        .addButton(button => button
            .setButtonText("Add Project")
            .onClick(async () => {
                if (newProjectName) {
                    this.plugin.projectModule.updateProject({ name: newProjectName });
                    this.updateProjectsToSettings();
                    // Refresh the settings tab to reflect the new project
                    this.display();
                }
            })
        );
}

// Update projects from projectModule to settings
updateProjectsToSettings() {
    const projects = this.plugin.projectModule.getProjectsData();
    this.plugin.writeSettings((old) => old.userMetadata.projects = projects);
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