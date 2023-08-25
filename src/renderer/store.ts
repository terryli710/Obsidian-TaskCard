import { Writable, writable } from 'svelte/store';
import { TaskDisplayMode } from './postProcessor';
import { SettingStore } from '../settings';
import { MarkdownView, Workspace, WorkspaceLeaf } from 'obsidian';
import { logger } from '../utils/log';
import { ObsidianTaskSyncProps } from '../taskModule/taskSyncManager';

export class TaskStore {
  private taskModes: Writable<{ [key: string]: TaskDisplayMode }>;
  public readonly subscribe: Function;
  private filePath: string = '';
  private defaultMode: TaskDisplayMode = 'single-line'; // Default value

  constructor() {
    this.taskModes = writable({});
    this.subscribe = this.taskModes.subscribe;

    SettingStore.subscribe((settings) => {
      this.defaultMode = settings.displaySettings.defaultMode as TaskDisplayMode;
    });
  }

  // FilePath-related Methods
  activeLeafChangeHandler(leaf: WorkspaceLeaf): void {
    const view = leaf.view as MarkdownView;
    if (!view.file) { return; }
    const newFilePath = view.file.path;
    const mode = view.getMode();
    if (mode !== 'preview') { this.clearTaskDisplayModes(); }
    this.setFilePath(newFilePath);
  }

  private clearTaskDisplayModes(): void {
    this.taskModes.set({});
  }

  private setFilePath(newFilePath: string): void {
    if (newFilePath !== this.filePath) {
      this.filePath = newFilePath;
      this.clearTaskDisplayModes();
    }
  }

  getDefaultMode(): TaskDisplayMode {
    return this.defaultMode;
  }

  // Mode-related CRUD Operations (By Line Numbers)
  setModeByLine(startLine: number, endLine: number, newMode: TaskDisplayMode = this.defaultMode): void {
    this.updateMode(this.generateKey(startLine, endLine), newMode);
  }

  getModeByLine(startLine: number, endLine: number): TaskDisplayMode | null {
    return this.getModeByKey(this.generateKey(startLine, endLine));
  }

  updateModeByLine(startLine: number, endLine: number, newMode: TaskDisplayMode): void {
    this.ensureMode(this.generateKey(startLine, endLine), newMode);
  }

  // Mode-related CRUD Operations (By Key)
  setModeByKey(key: string, newMode: TaskDisplayMode = this.defaultMode): void {
    this.updateMode(key, newMode);
  }

  getModeByKey(key: string): TaskDisplayMode | null {
    let mode = null;
    this.taskModes.subscribe((modes) => {
      mode = modes[key] || null;
    })();
    return mode;
  }

  updateModeByKey(key: string, newMode: TaskDisplayMode): void {
    this.ensureMode(key, newMode);
  }

  // Mode-related CRUD Operations (By Task Sync)
  setModeBySync(taskSync: ObsidianTaskSyncProps, newMode: TaskDisplayMode = this.defaultMode): void {
    this.updateMode(this.generateKeyFromSync(taskSync), newMode);
  }

  getModeBySync(taskSync: ObsidianTaskSyncProps): TaskDisplayMode | null {
    return this.getModeByKey(this.generateKeyFromSync(taskSync));
  }

  updateModeBySync(taskSync: ObsidianTaskSyncProps, newMode: TaskDisplayMode): void {
    this.ensureMode(this.generateKeyFromSync(taskSync), newMode);
  }

  // Ensure Mode Exists
  private ensureMode(key: string, newMode: TaskDisplayMode): void {
    this.taskModes.update((modes) => {
      if (modes[key]) {
        modes[key] = newMode;
      }
      return modes;
    });
  }

  // Get All Modes
  getAllModes(): { [key: string]: TaskDisplayMode } {
    let modes;
    this.taskModes.subscribe((currentModes) => {
      modes = { ...currentModes };
    })();
    return modes;
  }

  // Helper Methods
  private generateKey(startLine: number, endLine: number): string {
    return `${startLine}-${endLine}`;
  }

  private updateMode(key: string, newMode: TaskDisplayMode): void {
    this.taskModes.update((modes) => {
      modes[key] = newMode;
      return modes;
    });
  }

  private generateKeyFromSync(taskSync: ObsidianTaskSyncProps): string {
    const docLineStart = taskSync.taskMetadata.lineStartInSection + taskSync.taskMetadata.mdSectionInfo.lineStart;
    const docLineEnd = taskSync.taskMetadata.lineEndsInSection + taskSync.taskMetadata.mdSectionInfo.lineStart;
    return this.generateKey(docLineStart, docLineEnd);
  }
}
