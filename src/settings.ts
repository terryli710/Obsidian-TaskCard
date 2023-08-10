import { PluginSettingTab, Plugin, App, Setting } from 'obsidian';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import TaskCardPlugin from './index';
import { Project } from './taskModule/project';

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
    this.containerEl.createEl('h4', { text: 'Add new projects' });
    const projectContainer = this.containerEl.createEl('div', { cls: 'new-project-container' });
    this.newProjectSetting(projectContainer);
    const projects: Project[] = this.plugin.projectModule.getProjectsData();
    this.containerEl.createEl('h4', { text: 'Edit existing projects' });
    for (const project of projects) {
      const projectContainer = this.containerEl.createEl('div', { cls: 'project-container' });
      this.projectEditSetting(project, projectContainer);
    }

  }

  // Update projects from projectModule to settings
  updateProjectsToSettings() {
      const projects = this.plugin.projectModule.getProjectsData();
      this.plugin.writeSettings((old) => old.userMetadata.projects = projects);
  }

  newProjectSetting(projectContainer?: HTMLElement) {
    if (!projectContainer) {
        projectContainer = this.containerEl.createEl('div', { cls: 'project-container' });
    }

    let newProjectName = '';
    let newProjectColor = '';

    // Text field for project name
    const setting = new Setting(projectContainer).setName('Add a project')

    const textComponent = setting.addText(text => {
            text.setPlaceholder('Enter project name')
                .onChange(value => {
                    newProjectName = value;
                });
        })

    const colorComponent = setting.addColorPicker(colorPicker => {
            colorPicker.onChange(value => {
                newProjectColor = value;
            });
        })

    const button = setting.addButton(button => {
            button.setButtonText("Save")
                .onClick(() => {
                    if (newProjectName && newProjectColor) {
                        // if newProjectColor is selected, use it, if not, generate.
                        let newProject: Partial<Project>
                        if (!newProjectColor) {
                            newProject = { name: newProjectName }
                        } else {
                          newProject = { name: newProjectName, color: newProjectColor }
                        }
                        // Update the project in your data store
                        this.plugin.projectModule.updateProject(newProject)
                        this.updateProjectsToSettings();

                        // Re-render the settings to reflect the new project
                        this.display();
                    }
                });
        });
  }

  projectEditSetting(project: Project, projectContainer?: HTMLElement) {
    if (!projectContainer) {
        projectContainer = this.containerEl.createEl('div', { cls: 'project-container' });
    }

    // Heading for the Project Name
    const setting = new Setting(projectContainer)
        .setName('Project Name');

    const textComponent = setting.addText(text => {
        text.setValue(project.name)
            .onChange(value => {
                project.name = value;
            })
            .setDisabled(true); // Start in saved mode
    });

    const colorComponent = setting.addColorPicker(colorPicker => {
        colorPicker.setValue(project.color)
            .onChange(value => {
                project.color = value;
            })
            .setDisabled(true); // Start in saved mode
    });

    let isEditMode = false; // Flag to keep track of the current mode

    setting.addButton(button => {
        button.setButtonText("Edit")
            .onClick(() => {
                if (!isEditMode) {
                    // Switch to edit mode
                    textComponent.setDisabled(false);
                    colorComponent.setDisabled(false);
                    button.setButtonText("Save");
                    isEditMode = true;
                } else {
                    // Switch to saved mode
                    textComponent.setDisabled(true);
                    colorComponent.setDisabled(true);
                    button.setButtonText("Edit");
                    this.plugin.projectModule.updateProject(project);
                    this.updateProjectsToSettings();
                    this.display();
                    isEditMode = false;
                }
            });
    });
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