
import { Writable, writable } from 'svelte/store';
import { TaskMode } from './postProcessor';
import { SettingStore } from '../settings';
import { Workspace, WorkspaceLeaf } from 'obsidian';
import { logger } from '../utils/log';

export class TaskStore {
  private taskModes: Writable<{ [key: string]: TaskMode }>;
  public subscribe: Function;
  private filePath: string;
  private defaultMode: TaskMode;

  constructor() {
    this.taskModes = writable({});
    this.subscribe = this.taskModes.subscribe;
    this.filePath = '';
    
    SettingStore.subscribe((settings) => {
        this.defaultMode = settings.displaySettings.defaultMode as TaskMode;
    });
  }

  handleActiveLeafChange = (leaf: WorkspaceLeaf) => {
    // @ts-ignore
    const filePath = leaf.view.file.path;
    this.setFilePath(filePath);
  }

  setFilePath(newFilePath: string) {
    if (newFilePath !== this.filePath) {
      this.filePath = newFilePath;
      this.taskModes.set({});
    }
  }

  createMode(startLine: number, endLine: number, initialMode: TaskMode = 'single-line') {
    const key = `${startLine}-${endLine}`;
    this.taskModes.update((modes) => {
      modes[key] = initialMode;
      return modes;
    });
  }

  async getMode(startLine: number, endLine: number): Promise<TaskMode> {
    let mode;
    const key = `${startLine}-${endLine}`;
    this.taskModes.subscribe((modes) => {
      mode = modes[key];
    })();
    return mode;
  }

  async getAllModes(): Promise<{ [key: string]: TaskMode }> {
    let modes;
    this.taskModes.subscribe((modes) => {
      modes = modes;
    })
    return modes;
  }

  setMode(startLine: number, endLine: number, newMode: TaskMode): void {
    const key = `${startLine}-${endLine}`;
    this.taskModes.update((modes) => {
      modes[key] = newMode;
      return modes;
    });
  }

  setDefaultMode(startLine: number, endLine: number) {
    const key = `${startLine}-${endLine}`;
    this.taskModes.update((modes) => {
      modes[key] = this.defaultMode;
      return modes;
    });
  }

  deleteMode(startLine: number, endLine: number) {
    const key = `${startLine}-${endLine}`;
    this.taskModes.update((modes) => {
      delete modes[key];
      return modes;
    });
  }

  ensureMode(startLine: number, endLine: number, initialMode: TaskMode = 'single-line') {
    const key = `${startLine}-${endLine}`;
    this.taskModes.update((modes) => {
      if (modes[key] === undefined) {
        modes[key] = initialMode;
      }
      return modes;
    });
  }
}

export default new TaskStore();