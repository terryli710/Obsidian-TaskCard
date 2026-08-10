/** @jest-environment jsdom */

/**
 * Component tests for src/ui/Due.svelte (non-interactive mode).
 *
 * Due renders "today"-relative text, so the clock is pinned. Only `Date` is
 * faked (everything else in doNotFake) because Svelte's internal scheduling
 * relies on real microtasks/timers.
 *
 * Non-interactive mode takes a plain `taskItem` object, no plugin needed.
 */
import '@testing-library/jest-dom';
import { Notice } from 'obsidian';
import { fireEvent, loadSvelte, render, srcPath } from './testUtils';

let Due: any;

beforeAll(async () => {
  // load (async compile) BEFORE faking timers to keep preprocessing real-time
  Due = await loadSvelte(srcPath('ui/Due.svelte'));

  jest.useFakeTimers({
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout'
    ],
    now: new Date('2026-07-06T10:00:00')
  });
});

afterAll(() => {
  jest.useRealTimers();
});

interface DueDate {
  isRecurring: boolean;
  date: string;
  time: string | null;
  string: string;
}

function renderDue(
  due: DueDate | null,
  extras: { duration?: any; completed?: boolean } = {}
) {
  return render(Due, {
    props: {
      interactive: false,
      taskItem: {
        due,
        duration: extras.duration ?? null,
        completed: extras.completed ?? false
      },
      params: { mode: 'multi-line' },
      displayDue: false
    }
  });
}

function dueDate(date: string, time: string | null = null): DueDate {
  return { isRecurring: false, date, time, string: `${date} ${time ?? ''}` };
}

describe('Due (non-interactive)', () => {
  test('renders nothing when the task has no due date', () => {
    const { container } = renderDue(null);
    expect(container.querySelector('.task-card-due-container')).toBeNull();
  });

  test('future day-only value renders at calendar-day resolution with no status class', () => {
    const { container } = renderDue(dueDate('2026-07-08'));

    const containerEl = container.querySelector('.task-card-due-container')!;
    expect(containerEl).not.toBeNull();
    expect(containerEl.textContent).toContain('Wed');
    expect(containerEl.classList.contains('day-only')).toBe(true);
    expect(containerEl).toHaveAttribute('title', 'Any time on Wed, Jul 8');
    expect(containerEl.className).not.toMatch(/passDue|passed|ongoing/);
    // multi-line params -> multi-line mode class
    expect(containerEl.classList.contains('mode-multi-line')).toBe(true);
  });

  test('same-day deadline renders hour granularity', () => {
    const { container } = renderDue(dueDate('2026-07-06', '13:30'));

    expect(
      container.querySelector('.task-card-due-container')!.textContent
    ).toContain('3 hours');
  });

  test('imminent deadline (<15min) renders minutes and the upcoming style', () => {
    const { container } = renderDue(dueDate('2026-07-06', '10:10'));

    const due = container.querySelector('div.task-card-due')!;
    expect(due.textContent).toContain('10 minutes');
    expect(due.classList.contains('upcoming')).toBe(true);
  });

  test('ongoing task (now inside due + duration window) gets the ongoing style', () => {
    const { container } = renderDue(dueDate('2026-07-06', '09:30'), {
      duration: { hours: 1, minutes: 0 }
    });

    const containerEl = container.querySelector('.task-card-due-container')!;
    expect(containerEl.classList.contains('ongoing')).toBe(true);
    expect(containerEl.textContent).toContain('30 minutes overdue');
  });

  test('overdue unfinished task renders negative relative time and passDue style', () => {
    const { container } = renderDue(dueDate('2026-07-05', '08:00'));

    const containerEl = container.querySelector('.task-card-due-container')!;
    expect(containerEl.classList.contains('passDue')).toBe(true);
    expect(containerEl.textContent).toContain('1 day overdue'); // 26h overdue
  });

  test('overdue completed task gets the passed style instead of passDue', () => {
    const { container } = renderDue(dueDate('2026-07-05', '08:00'), {
      completed: true
    });

    const containerEl = container.querySelector('.task-card-due-container')!;
    expect(containerEl.classList.contains('passed')).toBe(true);
    expect(containerEl.classList.contains('passDue')).toBe(false);
  });
});

/* ------------------------------------------------------- interactive edits */

function makeSyncManager(due: DueDate | null) {
  const obsidianTask = {
    due,
    duration: null,
    completed: false,
    hasDue() {
      return !!this.due;
    },
    hasDuration() {
      return !!this.duration;
    }
  };
  return {
    obsidianTask,
    taskCardStatus: { dueStatus: 'done' },
    getTaskCardStatus(key: string) {
      return (this.taskCardStatus as any)[key];
    },
    updateObsidianTaskAttribute: jest.fn((key: string, value: any) => {
      (obsidianTask as any)[key] = value;
      return Promise.resolve();
    })
  };
}

function makePluginStub() {
  return {
    taskParser: {
      // "valid" inputs are anything containing a dash-date; everything else
      // fails to parse (mirrors parseSchedule returning null)
      parseSchedule: jest.fn((input: string) => {
        const match = input.match(/(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
        if (!match) return null;
        return {
          isRecurring: false,
          date: match[1],
          time: match[2] ?? null,
          string: input
        };
      })
    }
  };
}

function renderInteractiveDue(due: DueDate | null) {
  const syncManager = makeSyncManager(due);
  const plugin = makePluginStub();
  const result = render(Due, {
    props: {
      interactive: true,
      taskSyncManager: syncManager,
      plugin,
      params: { mode: 'multi-line' },
      displayDue: false
    }
  });
  return { syncManager, plugin, ...result };
}

async function openDueEditor(container: HTMLElement): Promise<HTMLInputElement> {
  await fireEvent.click(container.querySelector('.task-card-due-container')!);
  const input = container.querySelector('input.task-card-due') as HTMLInputElement;
  expect(input).not.toBeNull();
  return input;
}

describe('Due (interactive edit flow)', () => {
  beforeEach(() => {
    (Notice as any).__notices = [];
  });

  test('clicking the chip opens an input seeded with the resolved date', async () => {
    const { container } = renderInteractiveDue(dueDate('2026-07-08'));

    const input = await openDueEditor(container);
    expect(input.value).toBe('2026-07-08');
  });

  test('the add-attribute transition focuses a fresh editor with suggestions open', async () => {
    const result = renderInteractiveDue(null);
    result.syncManager.taskCardStatus.dueStatus = 'editing';
    await result.setProps({ displayDue: true });

    const input = result.container.querySelector('input.task-card-due');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(
      result.container.querySelector('.task-card-value-suggestions')
    ).not.toBeNull();
  });

  // Regression: a due saved as "tomorrow" resolves once; reopening the editor
  // later must show the frozen date, and committing it untouched must not
  // re-parse "tomorrow" against a new "today" (which shifted the date daily).
  test('a natural-language due seeds the editor with the resolved date and commits as a no-op', async () => {
    const { container, syncManager } = renderInteractiveDue({
      isRecurring: false,
      date: '2026-07-07',
      time: null,
      string: 'tomorrow'
    });

    const input = await openDueEditor(container);
    expect(input.value).toBe('2026-07-07');

    await fireEvent.blur(input);
    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
  });

  test('losing focus (clicking elsewhere) commits the changed due date', async () => {
    const { container, syncManager } = renderInteractiveDue(dueDate('2026-07-08'));

    const input = await openDueEditor(container);
    await fireEvent.input(input, { target: { value: '2026-07-10' } });
    await fireEvent.blur(input);

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'due',
      expect.objectContaining({ date: '2026-07-10' })
    );
    expect(container.querySelector('input.task-card-due')).toBeNull();
  });

  test('losing focus without a change closes the editor without writing', async () => {
    const { container, syncManager } = renderInteractiveDue(dueDate('2026-07-08'));

    const input = await openDueEditor(container);
    await fireEvent.blur(input);

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('input.task-card-due')).toBeNull();
  });

  test('an unparseable value reverts with a Notice instead of writing', async () => {
    const { container, syncManager } = renderInteractiveDue(dueDate('2026-07-08'));

    const input = await openDueEditor(container);
    await fireEvent.input(input, { target: { value: 'gibberish' } });
    await fireEvent.blur(input);

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect((Notice as any).__notices.join(' ')).toContain('Invalid due date');
    expect(container.querySelector('input.task-card-due')).toBeNull();
  });

  test('first Escape dismisses suggestions; second Escape discards the edit', async () => {
    const { container, syncManager } = renderInteractiveDue(dueDate('2026-07-08'));

    const input = await openDueEditor(container);
    await fireEvent.input(input, { target: { value: '2026-07-10' } });
    expect(container.querySelector('.task-card-value-suggestions')).not.toBeNull();
    await fireEvent.keyDown(input, { key: 'Escape' });

    expect(container.querySelector('.task-card-value-suggestions')).toBeNull();
    expect(container.querySelector('input.task-card-due')).not.toBeNull();
    await fireEvent.keyDown(input, { key: 'Escape' });

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('input.task-card-due')).toBeNull();
  });

  test('Enter chooses a parsed value before a second Enter commits it', async () => {
    const { container, syncManager } = renderInteractiveDue(dueDate('2026-07-08'));
    const input = await openDueEditor(container);
    await fireEvent.input(input, { target: { value: 'tomorrow at midnight' } });

    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('2026-07-07T00:00');
    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();

    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'due',
      expect.objectContaining({ date: '2026-07-07', time: '00:00' })
    );
  });

  test('emptying the editor clears the due date on commit', async () => {
    const { container, syncManager } = renderInteractiveDue(dueDate('2026-07-08'));

    const input = await openDueEditor(container);
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'due',
      null
    );
  });
});
