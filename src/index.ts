import { App, Plugin, htmlToMarkdown } from 'obsidian';
import type { MarkdownPostProcessor, MarkdownPostProcessorContext, PluginManifest } from 'obsidian';
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

  public taskCardPostProcessor: MarkdownPostProcessor = async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {

    logger.debug(`el: ${el.innerHTML}`);
    logger.debug(`el - markdown: ${htmlToMarkdown(el.innerHTML)}`);

    const potentialTaskCards = Array.from(el.querySelectorAll('li.task-list-item'));
    const taskCards = potentialTaskCards.filter(this.taskValidator.isValidTaskElement.bind(this.taskValidator));
    for (const taskCard of taskCards) {
      const taskItem = taskCard.parentElement as HTMLElement;

      const adapter = new TaskItemSvelteAdapter(taskItem, this);
      adapter.onload(); 
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
