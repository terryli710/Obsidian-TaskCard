import { Writable, writable } from 'svelte/store';
import { TaskMode } from './postProcessor';
import { SettingStore } from '../settings';

class TaskStore {
  private taskModes: Writable<{ [key: number]: TaskMode }>;
  public subscribe: Function;
  private filePath: string;
  private defaultMode: TaskMode;

  constructor() {
    this.taskModes = writable({});
    this.subscribe = this.taskModes.subscribe;  // Now it's safe
    this.filePath = '';
    
    SettingStore.subscribe((settings) => {
        this.defaultMode = settings.displaySettings.defaultMode as TaskMode;
    });
  }

  setFilePath(newFilePath: string) {
    if (newFilePath !== this.filePath) {
      this.filePath = newFilePath;
      this.taskModes.set({});
    }
  }

  createMode(lineNumber: number, initialMode: TaskMode = 'single-line') {
    this.taskModes.update((modes) => {
      modes[lineNumber] = initialMode;
      return modes;
    });
  }

  async getMode(lineNumber: number) {
    let mode;
    this.taskModes.subscribe((modes) => {
      mode = modes[lineNumber];
    })();
    return mode;
  }

  setMode(lineNumber: number, newMode: TaskMode) {
    this.taskModes.update((modes) => {
      modes[lineNumber] = newMode;
      return modes;
    });
  }

  setDefaultMode(lineNumber: number) {
    this.taskModes.update((modes) => {
      modes[lineNumber] = this.defaultMode;
      return modes;
    });
  }

  deleteMode(lineNumber: number) {
    this.taskModes.update((modes) => {
      delete modes[lineNumber];
      return modes;
    });
  }

  ensureMode(lineNumber: number, initialMode: TaskMode = 'single-line') {
    this.taskModes.update((modes) => {
      if (modes[lineNumber] === undefined) {
        modes[lineNumber] = initialMode;
      }
      return modes;
    });
  }
}

export default new TaskStore();
