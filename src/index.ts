import { App, MarkdownView, Plugin } from 'obsidian';
import type { PluginManifest, Workspace, WorkspaceLeaf } from 'obsidian';
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
import { TaskMonitor } from './taskModule/taskMonitor';
// import { TaskStore } from './renderer/store';

export default class TaskCardPlugin extends Plugin {
  public settings: TaskCardSettings;
  public projectModule: ProjectModule;
  public taskParser: TaskParser;
  public taskFormatter: TaskFormatter;
  public taskValidator: TaskValidator;
  public taskCardRenderManager: TaskCardRenderManager;
  public fileOperator: FileOperator;
  public taskMonitor: TaskMonitor;
  // public taskStore: TaskStore;

  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
    SettingStore.subscribe((settings) => {
      logger.info('Settings updated', settings);
      this.settings = settings;
    });
    this.projectModule = new ProjectModule();
    this.taskParser = new TaskParser(SettingStore, this.projectModule);
    this.taskFormatter = new TaskFormatter(SettingStore);
    this.taskValidator = new TaskValidator(SettingStore);
    this.taskCardRenderManager = new TaskCardRenderManager(this);
    this.fileOperator = new FileOperator(this, this.app);
    this.taskMonitor = new TaskMonitor(this, this.app);
    // this.taskStore = new TaskStore();
  }

  async loadSettings() {
    const loadedSettings = await this.loadData();
    SettingStore.update((old) => {
      return {
        ...old,
        ...(loadedSettings || {})
      };
    });
  }

  async writeSettings(
    changeOpts: (settings: TaskCardSettings) => void
  ): Promise<void> {
    SettingStore.update((old) => {
      changeOpts(old);
      return old;
    });
    await this.saveData(this.settings);
  }

  async onload() {
    await this.loadSettings();
    this.projectModule.updateProjects(
      this.settings.userMetadata.projects as Project[]
    );
    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerMarkdownPostProcessor(
      this.taskCardRenderManager.getPostProcessor()
    );
    this.registerEditorSuggest(new AttributeSuggest(this.app));
    this.registerEvent(
      this.app.workspace.on(
        'layout-change', 
        this.taskMonitor.layoutChangeHandler.bind(this.taskMonitor))
    );

    // this.registerEvent(this.app.workspace.on('file-open', () => logger.debug('file-open')));
    // this.registerEvent(this.app.workspace.on('layout-change', () => logger.debug('layout-change')));
    // this.registerEvent(this.app.workspace.on('window-open', () => logger.debug('window-open')));
    // this.registerEvent(this.app.workspace.on('window-close', () => logger.debug('window-close')));4
    // this.registerEvent(this.app.workspace.on('active-leaf-change', () => logger.debug('active-leaf-change')));

    logger.info('Plugin loaded.');
  }


}