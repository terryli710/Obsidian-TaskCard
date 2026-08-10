/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, loadSvelte, render, srcPath } from './testUtils';

let Recurrence: any;

beforeAll(async () => {
  Recurrence = await loadSvelte(srcPath('ui/Recurrence.svelte'));
});

function renderRecurrence(value: string | null = 'every month') {
  const task = {
    recurrence: value,
    hasRecurrence() {
      return !!this.recurrence;
    }
  };
  const syncManager = {
    obsidianTask: task,
    taskCardStatus: { recurrenceStatus: 'done' },
    getTaskCardStatus(key: string) {
      return (this.taskCardStatus as any)[key];
    },
    updateObsidianTaskAttribute: jest.fn((key: string, next: string | null) => {
      (task as any)[key] = next;
    })
  };
  const result = render(Recurrence, {
    props: {
      taskSyncManager: syncManager,
      plugin: {
        taskParser: {
          parseRecurrence: (input: string) =>
            input.startsWith('every ') ? input : null
        }
      },
      params: { mode: 'multi-line' },
      displayRecurrence: false
    }
  });
  return { syncManager, ...result };
}

describe('Recurrence contextual suggestions', () => {
  it('filters, chooses, then commits using the two-step Enter contract', async () => {
    const { container, syncManager } = renderRecurrence();
    await fireEvent.click(container.querySelector('.task-card-recurrence-container')!);
    const input = container.querySelector('input.task-card-recurrence') as HTMLInputElement;
    expect(container.querySelector('.task-card-value-suggestions')).not.toBeNull();

    await fireEvent.input(input, { target: { value: 'every w' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('every week');
    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();

    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'recurrence',
      'every week'
    );
  });
});
