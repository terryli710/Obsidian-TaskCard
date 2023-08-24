import { PluginSettingTab, App, Setting, Notice, ButtonComponent, TextComponent, ColorComponent } from 'obsidian';
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
    markdownSuffix: ' .'
  },
  displaySettings: {
    defaultMode: 'single-line'
  },
  userMetadata: {
    projects: {}
  },
  syncSettings: {}
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

  constructor(app: App, plugin: TaskCardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.settingStatus = {
      showColorPicker: false,
      newProjectName: '',
      newProjectColor: ''
    };
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
        const projectContainer = this.containerEl.createEl('div', {
          cls: 'project-container'
        });
        this.projectEditSetting(project, projectContainer);
      }
    } else {
      this.editProjectPlaceHolder();
    }
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
          colorPickerButton.setTooltip('Pick a color').setIcon('palette');
        }
      }
    };
  
    const setting = new Setting(this.containerEl).setName('Add A Project');
    setting.setDesc('Project names must be unique. Color picking is optional.');
  
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
            logger.info(`Project updated: ${project.name}`);
            new Notice(`[TaskCard] Project updated: ${project.name}.`);
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
      .setDesc('The tag used to identify task cards.')
      .addText((text) => {
        textField = text;
        return text
          .setPlaceholder('YourTagHere')
          .setValue(this.plugin.settings.parsingSettings.indicatorTag)
          .setDisabled(true)
          .onChange((value: string) => {
            const indicatorTag = value.replace(/^#/, '');
            this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = indicatorTag));
          });
      });
  
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
            this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = DefaultSettings.parsingSettings.indicatorTag));
            textField.setValue(DefaultSettings.parsingSettings.indicatorTag);
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
            this.plugin.writeSettings((old) => (old.parsingSettings.indicatorTag = textField.getValue()));
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
            await this.plugin.writeSettings(
              (old) => (old.displaySettings.defaultMode = value)
            );
            logger.info(`Default display mode updated: ${value}`);
            new Notice(`[TaskCard] Default display mode updated: ${value}.`);
          });
      });
  }
}
