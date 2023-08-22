import { Writable, writable } from 'svelte/store';
import { TaskMode } from './postProcessor';

// Writable store to hold the modes for each task
type TaskModes = { [key: string]: TaskMode };

const taskModes: Writable<TaskModes> = writable({});

// Actions to interact with the store
const taskStore = {
  subscribe: taskModes.subscribe,
  createMode: (id, initialMode: TaskMode = 'single-line') => {
    taskModes.update((modes) => {
      modes[id] = initialMode;
      return modes;
    });
  },
  getMode: async (id) => {
    let mode;
    taskModes.subscribe((modes) => {
      mode = modes[id];
    })();
    return mode;
  },
  setMode: (id, newMode) => {
    taskModes.update((modes) => {
      modes[id] = newMode;
      return modes;
    });
  },
  deleteMode: (id) => {
    taskModes.update((modes) => {
      delete modes[id];
      return modes;
    });
  },
  ensureMode: (id, initialMode: TaskMode = 'single-line') => {
    taskModes.update((modes) => {
      if (modes[id] === undefined) {
        modes[id] = initialMode;
      }
      return modes;
    });
  }
};

export default taskStore;
