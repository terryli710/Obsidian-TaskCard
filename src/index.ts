import { App, Plugin } from 'obsidian';
import type { MarkdownPostProcessorContext, PluginManifest } from 'obsidian';
import type { TaskCardSettings } from './settings';
import { SettingStore, SettingsTab } from './settings';
import { TaskItemSvelteAdapter } from './renderer/injector';
import { logger } from './utils/log';
import AttributeSuggest from './autoSuggestions/EditorSuggestions';
import { Project, ProjectModule } from './taskModule/project';
import { TaskParser } from './taskModule/taskParser';
import { TaskValidator } from './taskModule/taskValidator';

export default class TaskCardPlugin extends Plugin {
  public settings: TaskCardSettings;
  public projectModule: ProjectModule;
  public taskParser: TaskParser;
  public taskValidator: TaskValidator;

  
  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
    SettingStore.subscribe((settings) => {
      logger.info('Settings updated', settings);
      this.settings = settings;
    })
    this.projectModule = new ProjectModule();
    this.taskParser = new TaskParser(SettingStore, this.projectModule);
    this.taskValidator = new TaskValidator(SettingStore);
  }

  async taskCardPostProcessor(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    const potentialTaskCards = Array.from(el.querySelectorAll('li.task-list-item'));
    const taskCards = potentialTaskCards.filter(this.taskValidator.isValidTaskElement.bind(this.taskValidator));
    logger.debug(`el: ${el.innerHTML}`);
    const taskItems: HTMLElement[] = [];
    for (const taskCard of taskCards) { taskItems.push(taskCard.parentElement); }

    for (let i = 0; i < taskItems.length; i++) {
      const taskItem = taskItems[i] as HTMLElement;
      ctx.addChild(new TaskItemSvelteAdapter(taskItem, this));
    }
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
    this.registerMarkdownPostProcessor(this.taskCardPostProcessor.bind(this));
    this.registerEditorSuggest(new AttributeSuggest(this.app));
    logger.info('Plugin loaded.');
  }
}
