import { PluginSettingTab, App, Setting, Notice } from 'obsidian';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import TaskCardPlugin from './index';
import { Project } from './taskModule/project';
import { logger } from './utils/log';

export interface TaskCardSettings {
  parsingSettings: {
    markdownStartingNotation: string;
    markdownEndingNotation: string;
    indicatorTag: string;
    markdownSuffix: string;
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
    markdownSuffix: ' .',
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
  private settingStatus: {
    showColorPicker: boolean
  }
  
  constructor(app: App, plugin: TaskCardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.settingStatus = {
      showColorPicker: false
    }
  }

  display(): void {
    this.containerEl.empty();
    // title
    this.containerEl.createEl('h2', { text: 'Task Card' });
    // projects
    this.projectSettings();
    // parsing settings
    this.containerEl.createEl('h3', { text: 'Parsing Settings' });
    this.cardParsingSettings();
    // display settings
    this.containerEl.createEl('h3', { text: 'Display Settings' });
    this.cardDisplaySettings();
  }

  projectSettings() {
    this.containerEl.createEl('h3', { text: 'Project Adding' });

    this.newProjectSetting();
    const projects: Project[] = this.plugin.projectModule.getProjectsData();
    this.containerEl.createEl('h3', { text: 'Project Editing' });
    if (projects.length > 0) {
      const firstProject = projects[0];
      const restProjects = projects.slice(1);
      this.projectEditSetting(firstProject);
      for (const project of restProjects) {
        const projectContainer = this.containerEl.createEl('div', { cls: 'project-container' });
        this.projectEditSetting(project, projectContainer);
      }
    }

  }

  // Update projects from projectModule to settings
  updateProjectsToSettings() {
      const projects = this.plugin.projectModule.getProjectsData();
      this.plugin.writeSettings((old) => old.userMetadata.projects = projects);
  }

  newProjectSetting() {

    let newProjectName = '';
    let newProjectColor = '';

      const setting = new Setting(this.containerEl).setName('Add A Project');

      setting.setDesc('Project names must be unique. Color picking is optional.');

      setting.addText(text => {
          text.setPlaceholder('Enter project name')
              .setValue(newProjectName) // Set the stored value
              .onChange(value => {
                  newProjectName = value;
              });
      });

      if (this.settingStatus.showColorPicker) {
          setting.addColorPicker(colorPicker => {
              colorPicker.onChange(value => {
                  newProjectColor = value;
              });
          });
      } else {
          setting.addButton(button => {
              button.setTooltip("Pick a color")
                  .setIcon("palette")
                  .onClick(() => {
                    this.settingStatus.showColorPicker = true;
                    this.display();
                  });
          });
      }

      setting.addButton(button => {
          button.setTooltip("Finish")
              .setIcon("check-square")
              .onClick(() => {
                  if (newProjectName) {
                      const newProject: Partial<Project> = {
                          name: newProjectName,
                          color: newProjectColor
                      };
                      const succeeded = this.plugin.projectModule.addProject(newProject);
                      if (succeeded) {
                        this.updateProjectsToSettings();
                        this.display();
                      } else {
                        logger.error(`[TaskCard] Failed to add project: ${newProjectName}`);
                        new Notice(`[TaskCard] Failed to add project: ${newProjectName}. Project name must be unique.`);
                      }
                  }
                  this.settingStatus.showColorPicker = false;
                  this.display();
              });
      });
  };


  projectEditSetting(project: Project, projectContainerEl?: HTMLElement) {
    if (!projectContainerEl) {
        projectContainerEl = this.containerEl;
    }
    // Heading for the Project Name
    const setting = new Setting(projectContainerEl);
    setting.setName(project.name);

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
        button.setTooltip("Edit")
        .setIcon("pencil")
            .onClick(() => {
                if (!isEditMode) {
                    // Switch to edit mode
                    textComponent.setDisabled(false);
                    colorComponent.setDisabled(false);
                    button.setTooltip("Save").setIcon("save");
                    isEditMode = true;
                } else {
                    // Switch to saved mode
                    textComponent.setDisabled(true);
                    colorComponent.setDisabled(true);
                    button.setTooltip("Edit").setIcon("pencil");
                    this.plugin.projectModule.updateProject(project);
                    this.updateProjectsToSettings();
                    isEditMode = false;
                }
            });
    });

    // add a delete button, using the delete emoji
    setting.addButton(button => {
      button.setIcon("trash-2")
      .setTooltip("Delete project")
        .onClick(() => {
          this.plugin.projectModule.deleteProjectById(project.id);
          this.updateProjectsToSettings();
          this.display();
        });
    })
}

cardParsingSettings() {
  let textField: any;
  let isEditMode = false;

  const setting = new Setting(this.containerEl)

  setting.setName('Indicator Tag')
      .setDesc('The tag used to identify task cards.')
      .addText(text => {
          textField = text;
          return text
              .setPlaceholder('YourTagHere')
              .setValue(this.plugin.settings.parsingSettings.indicatorTag)
              .setDisabled(true) // Disable the text field initially
              .onChange(async (value: string) => {
                  // remove all the leading # from the value
                  const indicatorTag = value.replace(/^#/, '');
                  this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = indicatorTag));
              });
      });

  // Add an edit/save button
  setting.addButton(button => {
      button.setTooltip("Edit")
          .setIcon("pencil")
          .onClick(() => {
              if (!isEditMode) {
                  // Switch to edit mode
                  textField.setDisabled(false); // Enable the text field
                  button.setTooltip("Save").setIcon("save");
                  isEditMode = true;
              } else {
                  // Switch to saved mode
                  textField.setDisabled(true); // Disable the text field
                  this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = textField.getValue()));
                  button.setTooltip("Edit").setIcon("pencil");
                  isEditMode = false;
              }
          });
  });

  // Add a reset button
  setting.addButton(button => {
      button
          .setIcon("rotate-ccw")
          .setWarning()
          .setTooltip("Reset")
          .onClick(async () => {
              // Reset the value to the default
              this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = DefaultSettings.parsingSettings.indicatorTag));
              // Update the text field with the default value
              textField.setValue(DefaultSettings.parsingSettings.indicatorTag);
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
              'single-line': 'Single Line',
              'multi-line': 'Multi Line'
          })
          .setValue(this.plugin.settings.displaySettings.defaultMode)
          .onChange(async (value: string) => {
              await this.plugin.writeSettings((old) => (old.displaySettings.defaultMode = value));
          });
      });
  }



}