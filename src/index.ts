import { App, Plugin } from 'obsidian';
import type { Editor, EditorPosition, PluginManifest, Workspace, WorkspaceLeaf } from 'obsidian';
import type { TaskCardSettings } from './settings';
import { DefaultSettings, SettingStore, SettingsTab } from './settings';
import { logger } from './utils/log';
import AttributeSuggest from './autoSuggestions/EditorSuggestions';
import { Project, ProjectModule } from './taskModule/project';
import { TaskParser } from './taskModule/taskParser';
import { TaskValidator } from './taskModule/taskValidator';
import { StaticTaskListRenderManager, TaskCardRenderManager } from './renderer/index';
import { FileOperator } from './renderer/fileOperator';
import { TaskFormatter } from './taskModule/taskFormatter';
import { TaskMonitor } from './taskModule/taskMonitor';
import { TaskCardCache } from './query';


export default class TaskCardPlugin extends Plugin {
  public settings: TaskCardSettings;
  public projectModule: ProjectModule;
  public taskParser: TaskParser;
  public taskFormatter: TaskFormatter;
  public taskValidator: TaskValidator;
  public taskCardRenderManager: TaskCardRenderManager;
  public staticTaskListRenderManager: StaticTaskListRenderManager;
  public fileOperator: FileOperator;
  public taskMonitor: TaskMonitor;
  public cache: TaskCardCache;

  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
    SettingStore.subscribe((settings) => {
      // logger.info(`Settings updated: ${JSON.stringify(settings)}`);
      this.settings = settings;
    });
    this.projectModule = new ProjectModule();
    this.taskParser = new TaskParser(SettingStore, this.projectModule);
    this.taskFormatter = new TaskFormatter(SettingStore);
    this.taskValidator = new TaskValidator(SettingStore);
    this.taskCardRenderManager = new TaskCardRenderManager(this);
    this.fileOperator = new FileOperator(this, this.app);
    this.taskMonitor = new TaskMonitor(this, this.app, SettingStore);
    this.staticTaskListRenderManager = new StaticTaskListRenderManager(this);
    this.cache = new TaskCardCache(this);
  }
  
  async loadSettings() {
    // Load saved settings from storage
    const loadedSettings = await this.loadData();
  
    // Initialize settings with default values
    let initialSettings = JSON.parse(JSON.stringify(DefaultSettings));
  
    // Update the initial settings with any saved settings
    SettingStore.update((old) => {
      return {
        ...initialSettings, // Start with default settings
        ...old,             // Override with old settings (if any)
        ...loadedSettings   // Finally, override with loaded settings
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

  registerEvents() {
    this.registerEvent(
      this.app.workspace.on(
        'layout-change', 
        this.taskMonitor.layoutChangeHandler.bind(this.taskMonitor)
        )
    );

    // @ts-ignore
    this.registerEvent(this.app.metadataCache.on("dataview:metadata-change",
    (type, file, oldPath?) => { 
      // update cache tasks
      this.cache.taskCache.refreshTasksByFileList([file.path]);
    }));

    // this.registerEvent(this.app.workspace.on('file-open', () => logger.debug('file-open')));
    // this.registerEvent(this.app.workspace.on('layout-change', () => logger.debug('layout-change')));
    // this.registerEvent(this.app.workspace.on('window-open', () => logger.debug('window-open')));
    // this.registerEvent(this.app.workspace.on('window-close', () => logger.debug('window-close')));4
    // this.registerEvent(this.app.workspace.on('active-leaf-change', () => logger.debug('active-leaf-change')));

  }

  registerCommands() {
    this.addCommand({
      id: 'task-card-preview-display-mode',
      name: 'Preview Display Mode',
      callback: () => {
        this.taskMonitor.changeDisplayModeCommandHandler('single-line');
      }
    })
    
    this.addCommand({
      id: 'task-card-detailed-display-mode',
      name: 'Detailed Display Mode',
      callback: () => {
        this.taskMonitor.changeDisplayModeCommandHandler('multi-line');
      }
    })

    this.addCommand({
      id: 'task-card-add-query',
      name: 'Add Query',
      editorCallback: (editor: Editor) => {
        editor.replaceRange(
          `\n\`\`\`${this.settings.parsingSettings.blockLanguage}\n\`\`\``,
          editor.getCursor()
        )
      }
    })

    this.addCommand({
      id: 'task-card-add-task',
      name: 'Add Task',
      editorCallback: (editor: Editor) => {
        const editorPos: EditorPosition = editor.getCursor();
        editor.replaceRange(
          `\n- [ ]  #${this.settings.parsingSettings.indicatorTag}\n`,
          editorPos
        )
        editor.setCursor(editor.getCursor().line + 1, 6)
      }
    })
  }

  registerPostProcessors() {
    this.registerMarkdownPostProcessor(
      this.taskCardRenderManager.getPostProcessor()
    );

  //@ts-ignore
  this.registerEvent(this.app.metadataCache.on("dataview:index-ready", () => {
    setTimeout(() => {
      this.cache.taskCache.initializeAndRefreshAllTasks.bind(this.cache.taskCache)(),
      this.registerMarkdownCodeBlockProcessor('taskcard', 
        this.staticTaskListRenderManager.getCodeBlockProcessor()
      );
    }, 20); // delay of 200 milliseconds
  }));

  }

  async onload() {
    await this.loadSettings();
    this.projectModule.updateProjects(
      this.settings.userMetadata.projects as Project[]
    );
    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerEditorSuggest(new AttributeSuggest(this.app));
    this.registerPostProcessors();
    this.registerEvents();
    this.registerCommands();

    logger.info('Plugin loaded.');
  }
}