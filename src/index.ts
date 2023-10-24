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
import { CreateProjectModal } from './modal/createProjectModal';
import { TaskChangeAPI, TaskChangeEvent, TaskChangeType, getUpdatedProperties } from './taskModule/taskAPI';
import { CodeBlockProcessor } from './renderer/StaticTaskListRenderer';
import { ExternalAPIManager } from './api/externalAPIManager';


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
  public taskChangeAPI: TaskChangeAPI;
  public cache: TaskCardCache;
  public externalAPIManager: ExternalAPIManager;

  private static instance: TaskCardPlugin;

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
    this.taskChangeAPI = new TaskChangeAPI();
    this.externalAPIManager = new ExternalAPIManager(SettingStore);
    
    function printChangeListener(event: TaskChangeEvent): void {
      if (event.type === TaskChangeType.UPDATE) {
        const updatedProperties = getUpdatedProperties(event.previousState, event.currentState);
        logger.info(`Updated properties: ${JSON.stringify(updatedProperties)}`);
      } else {
        logger.info(`Received Task Change Event`, event);
      }
    }
    this.taskChangeAPI.registerListener(printChangeListener);
  
    this.cache = new TaskCardCache(this);
  }

  public static getInstance(): TaskCardPlugin {
		return TaskCardPlugin.instance;
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
      name: 'Add Task in a New Line',
      editorCallback: (editor: Editor) => {
        const editorPos: EditorPosition = editor.getCursor();
        editor.replaceRange(
          `\n- [ ]  #${this.settings.parsingSettings.indicatorTag}\n`,
          editorPos
        )
        editor.setCursor(editor.getCursor().line + 1, 6)
      }
    })

    this.addCommand({
      id: 'task-card-append-indicator-tag',
      name: 'Append Indicator Tag',
      editorCallback: (editor: Editor) => {
        const editorPos: EditorPosition = editor.getCursor();
        const currentLine = editor.getLine(editorPos.line);
        editor.replaceRange(` #${this.settings.parsingSettings.indicatorTag}`, { line: editorPos.line, ch: currentLine.length });
      }
    })

    // a command to pop up a modal to create a new project
    this.addCommand({
      id: 'task-card-create-project',
      name: 'Create a New Project',
      callback: () => {
        const projectCreationModel = new CreateProjectModal(this.app, this.projectModule.addProject.bind(this.projectModule));
        projectCreationModel.open();
      }
    })

    // a command to append indicator tag to each of the selected line, if they are tasks (and not subtasks)
    this.addCommand({
      id: 'task-card-add-indicator-tag',
      name: 'Add Indicator Tags to Selected Tasks',
      editorCallback: (editor: Editor) => {
        const selectionLines = editor.getSelection().split('\n');
        let isTask: boolean = false;
        let indentation: number = 0;
        let prevIsTask: boolean = false;
        let prevIndentation: number = 0;
        let newLines: string[] = [];
        for (let i = 0; i < selectionLines.length; i++) {
          const line = selectionLines[i];
          isTask = line.trim().startsWith('- [ ]');
          indentation = line.length - line.trimStart().length;
          const isSubTask = prevIsTask && prevIndentation < indentation;
          if (isTask && !isSubTask) {
            // Append the indicator tag to the task and continue the loop instead of breaking it
            newLines.push(line + ` #${this.settings.parsingSettings.indicatorTag}`);
          } else {
            // If it's not a task, or it's a subtask, just add the original line
            newLines.push(line);
          }
          // Save the current task status and indentation for the next iteration
          prevIsTask = isTask;
          prevIndentation = indentation;
        }
        // After exiting the loop, we need to join the new lines and replace the editor's selection with the new string
        const newSelection = newLines.join('\n');
        editor.replaceSelection(newSelection);
      },
    });
  }

  registerPostProcessors() {
    this.registerMarkdownPostProcessor(
      this.taskCardRenderManager.getPostProcessor()
    );
  
  let taskCardMarkdownCodeBlockProcessor: CodeBlockProcessor;

  setTimeout(() => {
    if (!taskCardMarkdownCodeBlockProcessor) {
      this.registerMarkdownCodeBlockProcessor('taskcard', 
        taskCardMarkdownCodeBlockProcessor = this.staticTaskListRenderManager.getCodeBlockProcessor()
      );
    }
  }, 3000);

  //@ts-ignore
  this.registerEvent(this.app.metadataCache.on("dataview:index-ready", () => {
    setTimeout(() => {
      this.cache.taskCache.initializeAndRefreshAllTasks.bind(this.cache.taskCache)()
      if (!taskCardMarkdownCodeBlockProcessor) {
        this.registerMarkdownCodeBlockProcessor('taskcard', 
          taskCardMarkdownCodeBlockProcessor = this.staticTaskListRenderManager.getCodeBlockProcessor()
        );
      }
    }, 20); // delay of 200 milliseconds
  }));

  }

  async onload() {
    await this.loadSettings();
    this.projectModule.updateProjects(
      this.settings.userMetadata.projects as Project[]
    );
    this.externalAPIManager.initAPIs();
    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerEditorSuggest(new AttributeSuggest(this.app));
    this.registerPostProcessors();
    this.registerEvents();
    this.registerCommands();
    TaskCardPlugin.instance = this;

    logger.info('Plugin loaded.');
  }
}