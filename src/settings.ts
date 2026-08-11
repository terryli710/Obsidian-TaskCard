import { Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import type { App, TextComponent } from 'obsidian';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type TaskCardPlugin from './index';
import type { Project } from './taskModule/project';
import { LabelModule } from './taskModule/labels/index';
// Calendar sync is suspended in this release. The stored settings and their
// types are kept so existing data.json content round-trips untouched, but no
// provider module is imported and no sync UI is rendered.
import type {
  GoogleSyncSetting,
  AppleCalendarSyncSetting,
  SyncSetting
} from './api/syncTypes';
import { cardDisplaySettings } from './settings/displaySettings';

export let emptyProject: Project = {
  id: '',
  name: ''
};

export interface TaskCardSettings {
  parsingSettings: {
    markdownStartingNotation: string;
    markdownEndingNotation: string;
    indicatorTag: string;
    markdownSuffix: string;
    blockLanguage: string;
    /** stamp `[completion:: YYYY-MM-DD]` when a task is completed via TaskCard */
    writeCompletionDate?: boolean;
  };
  displaySettings: {
    defaultMode: string;
    upcomingMinutes: number;
    queryDisplayMode: string;
    styleMetadataInLivePreview: boolean;
  };
  userMetadata: {
    projects: any;
    defaultProject: any;
    /** external sync mappings keyed by task block id (v2 keeps them out of notes) */
    syncMappingsById?: Record<string, any>;
    /** Google Calendar pull-sync bookkeeping (last successful poll) */
    googleSyncState?: { lastPullMs: number };
  };
  syncSettings: SyncSettings;
}

export interface SyncSettings {
  googleSyncSetting: GoogleSyncSetting;
  // WIP provider — absent until Apple Calendar sync ships (no default yet)
  appleCalendarSyncSetting?: AppleCalendarSyncSetting;
  // Todoist account info + other possible synced platforms
}

export type { SyncSetting };

export const DefaultSettings: TaskCardSettings = {
  parsingSettings: {
    markdownStartingNotation: '%%*',
    markdownEndingNotation: '*%%',
    indicatorTag: 'TaskCard',
    markdownSuffix: ' .',
    blockLanguage: 'taskcard',
    writeCompletionDate: true
  },
  displaySettings: {
    defaultMode: 'single-line',
    upcomingMinutes: 15,
    queryDisplayMode: 'list',
    styleMetadataInLivePreview: true
  },
  userMetadata: {
    projects: [],
    defaultProject: emptyProject,
    syncMappingsById: {},
    googleSyncState: { lastPullMs: 0 }
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
  }
};

export const SettingStore: Writable<TaskCardSettings> =
  writable<TaskCardSettings>(DefaultSettings);

export class SettingsTab extends PluginSettingTab {
  private plugin: TaskCardPlugin;
  private settingStatus: {
    updateExistingTasks: boolean;
    newProjectName: string;
    newProjectColor: string;
    hasNewProjectColor: boolean;
  };
  private labelModule: LabelModule;

  constructor(app: App, plugin: TaskCardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.settingStatus = {
      updateExistingTasks: false,
      newProjectName: '',
      newProjectColor: '',
      hasNewProjectColor: false
    };
    this.labelModule = new LabelModule();
  }

  display(): void {
    this.containerEl.empty();

    this.cardParsingSettings();

    new Setting(this.containerEl).setName('Display').setHeading();
    cardDisplaySettings(
      this.containerEl,
      this.plugin.settings,
      this.plugin.writeSettings.bind(this.plugin),
      this.display.bind(this),
      this.app
    );

    new Setting(this.containerEl).setName('Projects').setHeading();
    this.projectSettings();
  }

  private projectSettings(): void {
    this.containerEl.createDiv({
      text: 'Renaming or recoloring a project updates every task in that project.',
      cls: 'setting-item-description'
    });

    this.newProjectSetting();

    const projects: Project[] = this.plugin.projectModule.getProjectsData();
    if (projects.length > 0) {
      for (const project of projects) {
        this.projectSetting(project);
      }
    } else {
      this.containerEl.createDiv({
        text: 'No projects yet — add one above.',
        cls: 'setting-item-description'
      });
    }

    this.defaultProjectSetting(projects);
  }

  private async updateProjectsToSettings(): Promise<void> {
    const projects = this.plugin.projectModule.getProjectsData();
    await this.plugin.writeSettings(
      (old) => (old.userMetadata.projects = projects)
    );
  }

  private newProjectSetting(): void {
    let newProjectName = this.settingStatus.newProjectName;

    const addProject = async (): Promise<void> => {
      const name = newProjectName.trim();
      if (!name) return;

      const project: Partial<Project> = {
        name,
        ...(this.settingStatus.hasNewProjectColor && {
          color: this.settingStatus.newProjectColor
        })
      };
      if (!this.plugin.projectModule.addProject(project)) {
        new Notice('[TaskCard] Project names must be unique.');
        return;
      }

      await this.updateProjectsToSettings();
      this.settingStatus.newProjectName = '';
      this.settingStatus.newProjectColor = '';
      this.settingStatus.hasNewProjectColor = false;
      this.display();
    };

    new Setting(this.containerEl)
      .setName('Add a project')
      .setDesc('Names must be unique. Color is optional.')
      .addText((text) => {
        text
          .setPlaceholder('Project name')
          .setValue(newProjectName)
          .onChange((value) => {
            newProjectName = value;
            this.settingStatus.newProjectName = value;
          });
        text.inputEl?.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') void addProject();
        });
      })
      .addColorPicker((colorPicker) => {
        colorPicker
          .setValue(this.settingStatus.newProjectColor || '#000000')
          .onChange((value) => {
            this.settingStatus.newProjectColor = value;
            this.settingStatus.hasNewProjectColor = true;
          });
      })
      .addButton((button) => {
        button
          .setButtonText('Add')
          .setCta()
          .onClick(() => addProject());
      });
  }

  private projectSetting(project: Project): void {
    new Setting(this.containerEl)
      .setName(project.name)
      .addColorPicker((colorPicker) => {
        colorPicker.setValue(project.color || '#000000').setDisabled(true);
      })
      .addExtraButton((button) => {
        button
          .setIcon('pencil')
          .setTooltip('Edit')
          .onClick(() => {
            new ProjectEditModal(
              this.app,
              this.plugin,
              project,
              this.updateProjectsToSettings.bind(this),
              this.display.bind(this)
            ).open();
          });
      })
      .addExtraButton((button) => {
        button
          .setIcon('trash-2')
          .setTooltip('Delete')
          .onClick(() => {
            new ProjectDeleteModal(
              this.app,
              this.plugin,
              project,
              this.updateProjectsToSettings.bind(this),
              this.display.bind(this)
            ).open();
          });
      });
  }

  private defaultProjectSetting(projects: Project[]): void {
    let defaultProject = this.plugin.settings.userMetadata.defaultProject;
    if (
      defaultProject &&
      !projects.find((project) => project.id === defaultProject.id)
    ) {
      defaultProject = emptyProject;
    }

    const projectChoices = projects.reduce<Record<string, Project>>(
      (choices, project) => {
        choices[project.id] = project;
        return choices;
      },
      {}
    );

    new Setting(this.containerEl)
      .setName('Default project')
      .setDesc(
        "Automatically assigned to new tasks that don't specify a project."
      )
      .addDropdown((dropdown) => {
        dropdown.addOption('', 'No default project');
        dropdown.addOptions(
          projects.reduce<Record<string, string>>((choices, project) => {
            choices[project.id] = project.name;
            return choices;
          }, {})
        );
        dropdown.setValue(defaultProject?.id || '').onChange(async (value) => {
          const selectedProject = value
            ? projectChoices[value] || emptyProject
            : emptyProject;
          this.plugin.settings.userMetadata.defaultProject = selectedProject;
          await this.plugin.writeSettings((old) => {
            old.userMetadata.defaultProject = selectedProject;
          });
        });
      });
  }

  private cardParsingSettings(): void {
    let textField: TextComponent;

    const applyIndicatorTag = async (): Promise<void> => {
      const newIndicatorTag = textField.getValue().trim().replace(/^#+/, '');
      if (!newIndicatorTag || !this.labelModule.isValidLabel(newIndicatorTag)) {
        new Notice(`[TaskCard] Invalid indicator tag: ${newIndicatorTag}`);
        return;
      }

      const oldIndicatorTag = this.plugin.settings.parsingSettings.indicatorTag;
      if (newIndicatorTag === oldIndicatorTag) return;

      if (this.settingStatus.updateExistingTasks) {
        await this.plugin.taskMonitor.monitorVaultToChangeIndicatorTags(
          this.app.vault,
          newIndicatorTag,
          oldIndicatorTag
        );
      }
      await this.plugin.writeSettings(
        (old) => (old.parsingSettings.indicatorTag = newIndicatorTag)
      );
      this.display();
    };

    const indicatorDescription = createFragment((fragment) => {
      fragment.appendText(
        'The tag that marks a task as a TaskCard, e.g. #TaskCard. Takes effect after reloading Obsidian. '
      );
      fragment.createEl(
        'a',
        {
          text: 'Tag format',
          href: 'https://help.obsidian.md/Editing+and+formatting/Tags#Tag+format'
        },
        (link) => link.setAttr('target', '_blank')
      );
    });

    new Setting(this.containerEl)
      .setName('Indicator tag')
      .setDesc(indicatorDescription)
      .addText((text) => {
        textField = text;
        text
          .setPlaceholder('TaskCard')
          .setValue(this.plugin.settings.parsingSettings.indicatorTag);
        text.inputEl?.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') void applyIndicatorTag();
        });
      })
      .addExtraButton((button) => {
        button
          .setIcon('rotate-ccw')
          .setTooltip('Restore default')
          .onClick(() => {
            textField.setValue(DefaultSettings.parsingSettings.indicatorTag);
          });
      })
      .addButton((button) => {
        button
          .setButtonText('Apply')
          .setCta()
          .onClick(() => applyIndicatorTag());
      });

    new Setting(this.containerEl)
      .setName('Update existing tasks')
      .setDesc(
        'When applying a new indicator tag, also rewrite the old tag on existing task lines.'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.settingStatus.updateExistingTasks)
          .onChange((value) => {
            this.settingStatus.updateExistingTasks = value;
          });
      });

    this.completionDateSetting();
  }

  private completionDateSetting(): void {
    new Setting(this.containerEl)
      .setName('Write completion date')
      .setDesc(
        'When a task is completed through TaskCard, stamp the task line with ' +
          '[completion:: YYYY-MM-DD]. Turn off to avoid line churn in ' +
          'version-controlled vaults.'
      )
      .addToggle((toggle) => {
        toggle
          .setValue(
            this.plugin.settings.parsingSettings.writeCompletionDate !== false
          )
          .onChange(async (value) => {
            await this.plugin.writeSettings(
              (old) => (old.parsingSettings.writeCompletionDate = value)
            );
          });
      });
  }
}

class ProjectEditModal extends Modal {
  private editedProject: Project;

  constructor(
    app: App,
    private plugin: TaskCardPlugin,
    project: Project,
    private updateProjectsToSettings: () => Promise<void>,
    private rerenderSettings: () => void
  ) {
    super(app);
    this.editedProject = { ...project };
  }

  onOpen(): void {
    this.titleEl.setText('Edit project');

    new Setting(this.contentEl).setName('Project name').addText((text) => {
      text
        .setValue(this.editedProject.name)
        .onChange((value) => (this.editedProject.name = value));
    });

    new Setting(this.contentEl)
      .setName('Color')
      .addColorPicker((colorPicker) => {
        colorPicker
          .setValue(this.editedProject.color || '#000000')
          .onChange((value) => (this.editedProject.color = value));
      });

    new Setting(this.contentEl)
      .addButton((button) => {
        button
          .setButtonText('Save')
          .setCta()
          .onClick(() => this.save());
      })
      .addButton((button) => {
        button.setButtonText('Cancel').onClick(() => this.close());
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async save(): Promise<void> {
    this.editedProject.name = this.editedProject.name.trim();
    if (!this.editedProject.name) {
      new Notice('[TaskCard] Project name cannot be empty.');
      return;
    }

    const duplicateName = this.plugin.projectModule
      .getProjectsData()
      .some(
        (project) =>
          project.id !== this.editedProject.id &&
          project.name === this.editedProject.name
      );
    if (duplicateName) {
      new Notice('[TaskCard] Project names must be unique.');
      return;
    }

    const original = this.plugin.projectModule.getProjectById(
      this.editedProject.id
    );
    if (!original) {
      new Notice('[TaskCard] Project no longer exists.');
      return;
    }
    const originalProject = { ...original };

    this.plugin.projectModule.updateProject(this.editedProject);
    await this.updateProjectsToSettings();
    if (originalProject.name !== this.editedProject.name) {
      await this.plugin.taskMonitor.monitorVaultToChangeProjects(
        this.app.vault,
        this.editedProject,
        originalProject
      );
    }

    this.close();
    this.rerenderSettings();
  }
}

class ProjectDeleteModal extends Modal {
  constructor(
    app: App,
    private plugin: TaskCardPlugin,
    private project: Project,
    private updateProjectsToSettings: () => Promise<void>,
    private rerenderSettings: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText('Delete project');
    this.contentEl.createEl('p', {
      text: `Delete project '${this.project.name}'? Tasks keep their project field; this only removes the project from TaskCard's list.`
    });

    new Setting(this.contentEl)
      .addButton((button) => {
        button
          .setButtonText('Delete')
          .setWarning()
          .onClick(() => this.deleteProject());
      })
      .addButton((button) => {
        button.setButtonText('Cancel').onClick(() => this.close());
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async deleteProject(): Promise<void> {
    this.plugin.projectModule.deleteProjectById(this.project.id);
    await this.updateProjectsToSettings();
    this.close();
    this.rerenderSettings();
  }
}

export type { GoogleSyncSetting };
