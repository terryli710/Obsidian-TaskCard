import { App, Plugin } from 'obsidian';
import type { PluginManifest } from 'obsidian';
import type { TaskCardSettings } from './settings';
import { SettingStore, SettingsTab } from './settings';
import { logger } from './utils/log';
import AttributeSuggest from './autoSuggestions/EditorSuggestions';
import { Project, ProjectModule } from './taskModule/project';
import { TaskParser } from './taskModule/taskParser';
import { TaskValidator } from './taskModule/taskValidator';
import { TaskCardRenderManager } from './renderer/index';
import { FileOperator } from './renderer/fileOperator';
import { TaskFormatter } from './taskModule/taskFormatter';

export default class TaskCardPlugin extends Plugin {
  public settings: TaskCardSettings;
  public projectModule: ProjectModule;
  public taskParser: TaskParser;
  public taskFormatter: TaskFormatter
  public taskValidator: TaskValidator;
  public taskCardRenderManager: TaskCardRenderManager
  public fileOperator: FileOperator

  
  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
    SettingStore.subscribe((settings) => {
      logger.info('Settings updated', settings);
      this.settings = settings;
    })
    this.projectModule = new ProjectModule();
    this.taskParser = new TaskParser(SettingStore, this.projectModule);
    this.taskFormatter = new TaskFormatter(SettingStore);
    this.taskValidator = new TaskValidator(SettingStore);
    this.taskCardRenderManager = new TaskCardRenderManager(this);
    this.fileOperator = new FileOperator(this, this.app);
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
    this.projectModule.updateProjects(this.settings.userMetadata.projects as Project[]);
    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerMarkdownPostProcessor(this.taskCardRenderManager.getPostProcessor());
    this.registerEditorSuggest(new AttributeSuggest(this.app));
    logger.info('Plugin loaded.');
  }
}
