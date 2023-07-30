import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export interface TaskCardSettings {
  syncSetting: any; // Todoist account info + other possible synced platforms
  // TODO: some setting values
}

export const DefaultSettings: Writable<TaskCardSettings> =
  writable<TaskCardSettings>({
    syncSetting: {}
  });
