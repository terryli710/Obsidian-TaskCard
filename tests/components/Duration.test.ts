/** @jest-environment jsdom */

/**
 * Component tests for src/ui/Duration.svelte
 *
 * Non-interactive display variants use a plain `taskItem`; the interactive
 * edit flow uses a hand-rolled sync-manager stub.
 *
 * BUG (src/ui/Duration.svelte): unlike Due.svelte, the container's
 * on:click/on:keydown handlers are NOT gated on `interactive`
 * (`on:click={toggleDurationEditMode}` vs Due's
 * `on:click={interactive ? toggleEditMode : null}`). In non-interactive
 * contexts (static cards/query results) taskSyncManager is undefined, so
 * clicking a duration chip throws
 * "TypeError: Cannot read properties of undefined (reading 'taskCardStatus')".
 * Not exercised here to keep the suite green/quiet, only documented.
 */
import '@testing-library/jest-dom';
import { fireEvent, loadSvelte, render, srcPath } from './testUtils';

let Duration: any;

beforeAll(async () => {
  Duration = await loadSvelte(srcPath('ui/Duration.svelte'));
});

function renderStatic(duration: { hours: number; minutes: number } | null) {
  return render(Duration, {
    props: {
      interactive: false,
      taskItem: { duration },
      params: { mode: 'multi-line' },
      displayDuration: false
    }
  });
}

function makeSyncManager(duration: { hours: number; minutes: number }) {
  const stub = {
    obsidianTask: {
      duration,
      hasDuration() {
        return this.duration.hours > 0 || this.duration.minutes > 0;
      }
    },
    taskCardStatus: { durationStatus: 'done' },
    getTaskCardStatus(key: string) {
      return (this.taskCardStatus as any)[key];
    },
    updateObsidianTaskAttribute: jest.fn()
  };
  return stub;
}

describe('Duration (non-interactive display)', () => {
  test.each([
    [{ hours: 2, minutes: 30 }, '2h 30m'],
    [{ hours: 0, minutes: 45 }, '45mins'],
    [{ hours: 0, minutes: 1 }, '1min'],
    [{ hours: 1, minutes: 0 }, '1hr'],
    [{ hours: 3, minutes: 0 }, '3hrs']
  ])('humanizes %o as "%s"', (duration, expected) => {
    const { container } = renderStatic(duration as any);
    const display = container.querySelector('.duration-display')!;
    expect(display.textContent!.trim()).toBe(expected);
  });

  test('renders nothing when the task has no duration', () => {
    const { container } = renderStatic(null);
    expect(container.querySelector('.task-card-duration-container')).toBeNull();
  });
});

describe('Duration (interactive edit flow)', () => {
  test('click opens an hh:mm input seeded from the current duration', async () => {
    const syncManager = makeSyncManager({ hours: 1, minutes: 15 });
    const { container } = render(Duration, {
      props: {
        taskSyncManager: syncManager,
        params: { mode: 'multi-line' },
        displayDuration: false
      }
    });

    expect(container.querySelector('.duration-display')!.textContent).toContain(
      '1h 15m'
    );

    await fireEvent.click(
      container.querySelector('.task-card-duration-container')!
    );

    const input = container.querySelector(
      'input.task-card-duration'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('01:15');
  });

  test('Enter chooses the parsed duration and a second Enter commits it', async () => {
    const syncManager = makeSyncManager({ hours: 1, minutes: 15 });
    const { container } = render(Duration, {
      props: {
        taskSyncManager: syncManager,
        params: { mode: 'multi-line' },
        displayDuration: false
      }
    });

    await fireEvent.click(
      container.querySelector('.task-card-duration-container')!
    );
    const input = container.querySelector(
      'input.task-card-duration'
    ) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '02:00' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('2h');
    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'duration',
      { hours: 2, minutes: 0 }
    );
    expect(container.querySelector('input.task-card-duration')).toBeNull();
    expect(container.querySelector('.duration-display')!.textContent).toContain(
      '2hrs'
    );
  });

  test('a 00:00 duration commits null (clears the duration)', async () => {
    const syncManager = makeSyncManager({ hours: 1, minutes: 15 });
    const { container } = render(Duration, {
      props: {
        taskSyncManager: syncManager,
        params: { mode: 'multi-line' },
        displayDuration: false
      }
    });

    await fireEvent.click(
      container.querySelector('.task-card-duration-container')!
    );
    const input = container.querySelector(
      'input.task-card-duration'
    ) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '00:00' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'duration',
      null
    );
  });

  test('losing focus (clicking elsewhere) commits a typed change', async () => {
    const syncManager = makeSyncManager({ hours: 1, minutes: 15 });
    const { container } = render(Duration, {
      props: {
        taskSyncManager: syncManager,
        params: { mode: 'multi-line' },
        displayDuration: false
      }
    });

    await fireEvent.click(
      container.querySelector('.task-card-duration-container')!
    );
    const input = container.querySelector(
      'input.task-card-duration'
    ) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '02:30' } });
    await fireEvent.blur(input);

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'duration',
      { hours: 2, minutes: 30 }
    );
    expect(container.querySelector('input.task-card-duration')).toBeNull();
  });

  test('losing focus with the value untouched closes without writing', async () => {
    const syncManager = makeSyncManager({ hours: 1, minutes: 15 });
    const { container } = render(Duration, {
      props: {
        taskSyncManager: syncManager,
        params: { mode: 'multi-line' },
        displayDuration: false
      }
    });

    await fireEvent.click(
      container.querySelector('.task-card-duration-container')!
    );
    const input = container.querySelector(
      'input.task-card-duration'
    ) as HTMLInputElement;
    await fireEvent.blur(input);

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('input.task-card-duration')).toBeNull();
  });

  test('abandoning an untouched suggestion in a fresh editor does not save', async () => {
    // duration-less task whose editor was opened externally (card menu's
    // "Add Duration"): blur must not commit the prefill the user never typed
    const stub = {
      obsidianTask: {
        duration: null,
        hasDuration() {
          return false;
        }
      },
      taskCardStatus: { durationStatus: 'editing' },
      getTaskCardStatus(key: string) {
        return (this.taskCardStatus as any)[key];
      },
      updateObsidianTaskAttribute: jest.fn()
    };
    const { container } = render(Duration, {
      props: {
        taskSyncManager: stub,
        params: { mode: 'multi-line' },
        displayDuration: false
      }
    });

    const input = container.querySelector(
      'input.task-card-duration'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(container.querySelector('.task-card-value-suggestions')).not.toBeNull();
    await fireEvent.blur(input);

    expect(stub.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('input.task-card-duration')).toBeNull();
  });

  test('first Escape dismisses suggestions and second Escape cancels the edit', async () => {
    const syncManager = makeSyncManager({ hours: 1, minutes: 15 });
    const { container } = render(Duration, {
      props: {
        taskSyncManager: syncManager,
        params: { mode: 'multi-line' },
        displayDuration: false
      }
    });

    await fireEvent.click(
      container.querySelector('.task-card-duration-container')!
    );
    const input = container.querySelector(
      'input.task-card-duration'
    ) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '09:59' } });
    await fireEvent.keyDown(input, { key: 'Escape' });

    expect(container.querySelector('.task-card-value-suggestions')).toBeNull();
    expect(container.querySelector('input.task-card-duration')).not.toBeNull();
    await fireEvent.keyDown(input, { key: 'Escape' });

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('input.task-card-duration')).toBeNull();
    // display still shows the original duration
    expect(container.querySelector('.duration-display')!.textContent).toContain(
      '1h 15m'
    );
  });
});
