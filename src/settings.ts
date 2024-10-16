import { PluginSettingTab, App, Setting, Notice, ButtonComponent, TextComponent, ColorComponent } from 'obsidian';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import TaskCardPlugin from './index';
import { Project } from './taskModule/project';
import { logger } from './utils/log';
import { LabelModule } from './taskModule/labels/index';
import { GoogleSyncSetting, googleCalendarSyncSettings } from './settings/syncSettings/googleCalendarSettings';
import { cardDisplaySettings } from './settings/displaySettings';


export let emptyProject: Project = {
  id: '',
  name: ''
}

export interface TaskCardSettings {
  parsingSettings: {
    markdownStartingNotation: string;
    markdownEndingNotation: string;
    indicatorTag: string;
    markdownSuffix: string;
    blockLanguage: string
  };
  displaySettings: {
    defaultMode: string;
    upcomingMinutes: number;
    queryDisplayMode: string;
  };
  userMetadata: {
    projects: any;
    defaultProject: any;
  };
  syncSettings: SyncSettings;
}

export interface SyncSettings {
  googleSyncSetting: GoogleSyncSetting
  // Todoist account info + other possible synced platforms
}

export interface SyncSetting {
  isLogin: boolean;
}

export const DefaultSettings: TaskCardSettings = {
  parsingSettings: {
    markdownStartingNotation: '%%*',
    markdownEndingNotation: '*%%',
    indicatorTag: 'TaskCard',
    markdownSuffix: ' .',
    blockLanguage: 'taskcard'
  },
  displaySettings: {
    defaultMode: 'single-line',
    upcomingMinutes: 15,
    queryDisplayMode: 'line'
  },
  userMetadata: {
    projects: {},
    defaultProject: emptyProject,
  },
  syncSettings: {
    googleSyncSetting: {
      clientID: '',
      clientSecret: '',
      isLogin: false,
      doesNeedFilters: false,
      filterTag: '',
      filterProject: '',
      defaultCalendarId: ''
    }
  },
};

export const SettingStore: Writable<TaskCardSettings> =
  writable<TaskCardSettings>(DefaultSettings);

export class SettingsTab extends PluginSettingTab {
  private plugin: TaskCardPlugin;
  private settingStatus: {
    showColorPicker: boolean;
    newProjectName: string;
    newProjectColor: string;
  };
  private labelModule: LabelModule;

  constructor(app: App, plugin: TaskCardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.settingStatus = {
      showColorPicker: false,
      newProjectName: '',
      newProjectColor: ''
    };
    this.labelModule = new LabelModule();
  }

  display(): void {
    this.containerEl.empty();
    // projects
    this.projectSettings();
    // parsing settings
    this.containerEl.createEl('h2', { text: 'Parsing Settings' });
    this.cardParsingSettings();
    // display settings
    this.containerEl.createEl('h2', { text: 'Display Settings' });
    cardDisplaySettings(
        this.containerEl,
        this.plugin.settings,
        this.plugin.writeSettings.bind(this.plugin),
        this.display.bind(this),
    );
    // sync settings
    // 1. google calendar
    this.containerEl.createEl('h2', { text: 'Sync Settings' });
    this.containerEl.createEl('h3', { text: 'Google Calendar Sync Setting' });
    googleCalendarSyncSettings(
        this.containerEl, 
        this.plugin.settings, 
        this.plugin.writeSettings.bind(this.plugin), 
        this.display.bind(this),
        this.plugin.projectModule,
        this.plugin.externalAPIManager.googleCalendarAPI
        );
  }

  projectSettings() {
    this.containerEl.createEl('h3', { text: 'Project Adding' });

    this.newProjectSetting();

    const projects: Project[] = this.plugin.projectModule.getProjectsData();

    this.containerEl.createEl('h3', { text: 'Project Editing' });
    if (projects.length > 0) {
      this.containerEl.createEl('div', 
      { text: 'Changes to the project will be automatically applied to ALL TASKS within this project.', 
        cls: 'setting-item-description' });
      const firstProject = projects[0];
      const restProjects = projects.slice(1);
      this.projectEditSetting(firstProject);
      for (const project of restProjects) {
        const projectContainer = this.containerEl.createEl('div', {
          cls: 'project-container'
        });
        this.projectEditSetting(project, projectContainer);
      }
    } else {
      this.editProjectPlaceHolder();
    }

    this.containerEl.createEl('h3', { text: 'Default Project' });
    this.defaultProjectSetting(projects);

  }

  // Update projects from projectModule to settings
  updateProjectsToSettings() {
    const projects = this.plugin.projectModule.getProjectsData();
    this.plugin.writeSettings((old) => (old.userMetadata.projects = projects));
  }

  editProjectPlaceHolder() {
    // used when there's no project saved
    const setting = new Setting(this.containerEl).setName('Project Name');
    setting.setDesc(`Projects can be edited here.`);
    setting.addButton((button) => {
      button.setTooltip('Edit').setIcon('pencil').setDisabled(true);
    });
    setting.addButton((button) => {
      button.setTooltip('Delete Project').setIcon('trash-2').setDisabled(true);
    });
  }


  newProjectSetting() {
    // If these variables are losing their values on a redraw, consider moving them 
    // to the class scope to retain their values across function calls.
    let newProjectName = this.settingStatus.newProjectName || ''; // Retrieve stored name if available
    let newProjectColor = this.settingStatus.newProjectColor || '';
    let colorPickerComponent: ColorComponent;
    let colorPickerButton: ButtonComponent;
    let isColorPickerMode = this.settingStatus.showColorPicker || false;
  
    const updateUI = () => {
      if (colorPickerButton) {
        if (isColorPickerMode) {
          colorPickerButton.setTooltip('Cancel').setIcon('circle-off');
        } else {
          colorPickerButton.setTooltip('Pick a color (optional)').setIcon('palette');
        }
      }
    };
  
    const setting = new Setting(this.containerEl).setName('Add A Project');
    setting.setDesc('Project names must be UNIQUE. Color picking is OPTIONAL.');
  
    setting.addText((text) => {
      text
        .setPlaceholder('Enter project name')
        .setValue(newProjectName) // Set the stored value
        .onChange((value) => {
          newProjectName = value;
          this.settingStatus.newProjectName = value; // Store the value for later use
        });
    });

    if (isColorPickerMode) {
      setting.addColorPicker((colorPicker) => {
        colorPickerComponent = colorPicker;
        colorPicker.onChange((value) => {
          newProjectColor = value;
          this.settingStatus.newProjectColor = value; // Store the color value if needed
        });
      });
    }
  
    // Color picker or its button
    setting.addButton((button) => {
      colorPickerButton = button;
      button
        .onClick(() => {
          if (isColorPickerMode) {
            // Cancel color picking
            isColorPickerMode = false;
            newProjectColor = ''; // Reset the selected color
            this.settingStatus.newProjectColor = ''; // Reset the stored color
          } else {
            // Enter color picking mode
            isColorPickerMode = true;
          }
          this.settingStatus.showColorPicker = isColorPickerMode; // Store the state
          updateUI();
          this.display(); // Re-render the setting to add or remove the color picker
        });
    });
  
    // Finish button
    setting.addButton((button) => {
      button
        .setTooltip('Finish')
        .setIcon('check-square')
        .setCta()
        .onClick(() => {
          if (newProjectName) {
            const newProject = {
              name: newProjectName,
              color: newProjectColor
            };
            const succeeded = this.plugin.projectModule.addProject(newProject);
            if (succeeded) {
              this.updateProjectsToSettings();
              this.settingStatus.newProjectName = '';
              this.settingStatus.newProjectColor = '';
              logger.info(`Project added: ${newProjectName}`);
              new Notice(`[TaskCard] Project added: ${newProjectName}.`);
            } else {
              logger.error(`Failed to add project: ${newProjectName}`);
              new Notice(`[TaskCard] Failed to add project: ${newProjectName}. Project name must be unique.`);
            }
          }
          // Reset color picker mode
          isColorPickerMode = false;
          this.settingStatus.showColorPicker = false;
          this.display();
        });
    });
  
    // Initialize the UI components based on the initial isColorPickerMode value
    updateUI();
  }
  

  projectEditSetting(project, projectContainerEl?: HTMLElement) {
    if (!projectContainerEl) {
      projectContainerEl = this.containerEl;
    }
  
    let isEditMode = false;
    let isDeleteWarning = false;
    let textComponent: TextComponent;
    let colorComponent: ColorComponent;
    let editCancelButton: ButtonComponent;
    let saveDeleteButton: ButtonComponent;
  
    const updateUI = () => {
      if (textComponent && colorComponent && editCancelButton && saveDeleteButton) {
        textComponent.setDisabled(!isEditMode);
        colorComponent.setDisabled(!isEditMode);
  
        if (isEditMode) {
          editCancelButton.setTooltip('Cancel').setIcon('x-circle');
          saveDeleteButton.setTooltip('Save').setIcon('save').setCta();
        } else if (isDeleteWarning) {
          editCancelButton.setTooltip('Confirm Delete').setIcon('trash-2').setWarning();
          saveDeleteButton.setTooltip('Cancel').setIcon('x-circle');
        } else {
          editCancelButton.setTooltip('Edit').setIcon('pencil');
          saveDeleteButton.setTooltip('Delete').setIcon('trash-2');
        }
      }
    };
  
    // Heading for the Project Name
    const setting = new Setting(projectContainerEl);
    setting.setName(project.name);
  
    // Text Component
    setting.addText((text) => {
      text
        .setValue(project.name)
        .onChange((value) => {
          project.name = value;
        });
      textComponent = text;
    });
  
    // Color Component
    setting.addColorPicker((colorPicker) => {
      colorPicker
        .setValue(project.color)
        .onChange((value) => {
          project.color = value;
        });
      colorComponent = colorPicker;
    });
  
    // Edit/Cancel Button
    setting.addButton((button) => {
      editCancelButton = button;
      button
        .onClick(() => {
          if (isEditMode) {
            // Cancel edit mode
            isEditMode = false;
            this.display();
            logger.info(`Edit cancelled for project: ${project.name}`);
            new Notice(`[TaskCard] Edit cancelled for project: ${project.name}.`);
          } else if (isDeleteWarning) {
            // Confirm delete
            isDeleteWarning = false;
            this.plugin.projectModule.deleteProjectById(project.id);
            this.updateProjectsToSettings();
            logger.info(`Project deleted: ${project.name}`);
            new Notice(`[TaskCard] Project deleted: ${project.name}.`);
            this.display();
          } else {
            // Enter edit mode
            isEditMode = true;
            this.plugin.projectModule.updateProject(project);
            this.updateProjectsToSettings();
          }
          updateUI();
        });
    });
  
    // Save/Delete Button
    setting.addButton((button) => {
      saveDeleteButton = button;
      button
        .onClick(() => {
          if (isEditMode) {
            // Save changes
            isEditMode = false;
            const originalProject: Project = this.plugin.projectModule.getProjectById(project.id);
            this.announceProjectChange(originalProject, project);
            this.plugin.projectModule.updateProject(project);
            this.updateProjectsToSettings();
            this.plugin.taskMonitor.monitorVaultToChangeProjects(this.app.vault, project, originalProject);
            this.display();
          } else if (isDeleteWarning) {
            // Cancel delete warning
            isDeleteWarning = false;
            this.display();
          } else {
            // Enter delete warning mode
            isDeleteWarning = true;
          }
          updateUI();
        });
    });
  
    // Initialize the UI
    updateUI();
  }

  defaultProjectSetting(projects: Project[]) {
    // Check if the default project is still in the projects list
    let defaultProject = this.plugin.settings.userMetadata.defaultProject;
    if (defaultProject && !projects.find(p => p.id === defaultProject.id)) {
      defaultProject = emptyProject;
    }

    let defaultProjectId = defaultProject.id;
  
    const setting = new Setting(this.containerEl);
    setting.setName('Default Project');
  
    if (!projects.length) {
      setting.setDesc('No projects available.');
      return;
    }
  
    // Create a dropdown with project names as choices
    setting.addDropdown(dropdown => {
      const choices = projects.reduce((acc, project) => {
        acc[project.id] = `${project.name}`; // Displaying name and color
        return acc;
      }, {});
      const projectChoices = projects.reduce((acc, project) => {
        acc[project.id] = project 
        acc[''] = undefined;
        return acc
      }, {})
  
      dropdown.addOption('', 'No default project');
      dropdown.addOptions(choices);
  
      dropdown.setValue(defaultProjectId || '');
      dropdown.onChange(value => {
        defaultProjectId = value;
        if (!value) {
          this.plugin.settings.userMetadata.defaultProject = emptyProject;
          new Notice(`[TaskCard] Default project set to no project.`);
        }
        defaultProject = projectChoices[value];
        this.plugin.settings.userMetadata.defaultProject = defaultProject;
        new Notice(`[TaskCard] Default project changed to: ${defaultProject.name}.`);
        this.plugin.writeSettings((old) => {
          old.userMetadata.defaultProject
        })
      });
    });
  }
  
  announceProjectChange(originalProject: Project, newProject: Project) {
    // if name changed, if color changed, if name + color changed
    if (originalProject.name !== newProject.name && originalProject.color !== newProject.color) {
      new Notice(`[TaskCard] Project name and color updated: ${newProject.name}.`);
    } else if (originalProject.name !== newProject.name) {
      new Notice(`[TaskCard] Project name updated: ${newProject.name}.`);
    } else if (originalProject.color !== newProject.color) {
      new Notice(`[TaskCard] Project color updated: ${newProject.color}.`);
    }
  }
  
  
  cardParsingSettings() {
    let textField: any;
    let editCancelButton: ButtonComponent;
    let saveResetButton: ButtonComponent;
  
    let isEditMode = false;
    let isResetWarning = false;
  
    const updateUI = () => {
      if (textField && editCancelButton && saveResetButton) {
        textField.setDisabled(!isEditMode);
  
        if (isEditMode) {
          editCancelButton.setTooltip('Cancel').setIcon('x-circle');
          saveResetButton.setTooltip('Save').setIcon('save').setCta();
        } else if (isResetWarning) {
          editCancelButton.setTooltip('Confirm Reset').setIcon('rotate-ccw').setWarning();
          saveResetButton.setTooltip('Cancel').setIcon('x-circle');
        } else {
          editCancelButton.setTooltip('Edit').setIcon('pencil');
          saveResetButton.setTooltip('Reset').setIcon('rotate-ccw');
        }
      }
    };
  
    const setting = new Setting(this.containerEl);

    setting
      .setName('Indicator Tag')
      .then((setting) => {
        setting.descEl.appendChild(
          createFragment((frag) => {
            frag.appendText(
              'The tag used to identify task cards. ' +
              'Will take full effect after reloading obsidian. ' +
              'Toggle on to convert existing tasks\' tags when indicator tag is changed. ' +
              'Indicator tag must be a valid Obsidian tag, e.g. #TaskCard. Refer to '
            );
            frag.createEl(
              'a',
              {
                text: 'Tag format',
                href: 'https://help.obsidian.md/Editing+and+formatting/Tags#Tag+format'
              },
              (a) => {
                a.setAttr('target', '_blank');
              }
            );
            frag.createEl('br');
          })
        );
      });
  
    let convertTaskIndicatorTags: boolean = false
    
    setting.addToggle((toggle) => {
      toggle
        .setTooltip('Convert task indicator tags as well')
        .setValue(convertTaskIndicatorTags)
        .onChange((value) => {
          convertTaskIndicatorTags = value
        })
    })

    setting.addText((text) => {
      textField = text;
      return text
        .setPlaceholder('YourTagHere')
        .setValue(this.plugin.settings.parsingSettings.indicatorTag)
        .setDisabled(true)
    })
  
    // Add an Edit/Cancel button
    setting.addButton((button) => {
      editCancelButton = button;
      button
        .onClick(() => {
          if (isEditMode) {
            // Cancel edit mode
            isEditMode = false;
            this.display();
          } else if (isResetWarning) {
            // Confirm reset
            isResetWarning = false;
            const oldIndicatorTag = this.plugin.settings.parsingSettings.indicatorTag;
            const newIndicatorTag = DefaultSettings.parsingSettings.indicatorTag;
            if (convertTaskIndicatorTags && oldIndicatorTag !== newIndicatorTag) {
              this.plugin.taskMonitor.monitorVaultToChangeIndicatorTags(
                this.app.vault, '#' + newIndicatorTag, '#' + oldIndicatorTag);
            }
            this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = DefaultSettings.parsingSettings.indicatorTag));
            this.display();
            logger.info(`Indicator tag reset to default.`);
            new Notice(`[TaskCard] Indicator tag reset to default.`);
          } else {
            // Enter edit mode
            isEditMode = true;
          }
          updateUI();
        });
    });
  
    // Add a Save/Reset button
    setting.addButton((button) => {
      saveResetButton = button;
      button
        .onClick(() => {
          if (isEditMode) {
            // Save changes
            isEditMode = false;
            const newIndicatorTag = textField.getValue();
            const oldIndicatorTag = this.plugin.settings.parsingSettings.indicatorTag;
            if (!newIndicatorTag) {
              logger.warn(`Indicator Tag cannot be empty.`);
              new Notice(`[TaskCard] Indicator Tag cannot be empty.`);
              return;
            } 
            if (!this.labelModule.isValidLabel(newIndicatorTag)) {
              logger.warn(`Invalid indicator tag: ${newIndicatorTag}`);
              new Notice(`[TaskCard] Invalid indicator tag: ${newIndicatorTag}.`);
              return;
            }
            if (convertTaskIndicatorTags && newIndicatorTag !== oldIndicatorTag) {
              this.plugin.taskMonitor.monitorVaultToChangeIndicatorTags(
                this.app.vault, newIndicatorTag, oldIndicatorTag);
            }
            this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = newIndicatorTag));
            this.display();
            logger.info(`Indicator tag updated: ${textField.getValue()}`);
            new Notice(`[TaskCard] Indicator tag updated: ${textField.getValue()}.`);
          } else if (isResetWarning) {
            // Cancel reset warning
            isResetWarning = false;
            this.display();
          } else {
            // Enter reset warning mode
            isResetWarning = true;
          }
          updateUI();
        });
    });
  
    // Initialize the UI
    updateUI();
  }
  

}
export { GoogleSyncSetting };

