/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, loadSvelte, render, srcPath } from './testUtils';

let Schedule: any;

beforeAll(async () => {
  Schedule = await loadSvelte(srcPath('ui/Schedule.svelte'));
  jest.useFakeTimers({
    doNotFake: [
      'hrtime', 'nextTick', 'performance', 'queueMicrotask',
      'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'
    ],
    now: new Date('2026-07-10T19:00:00')
  });
});

afterAll(() => jest.useRealTimers());

function renderSchedule(date: string, time?: string) {
  return render(Schedule, {
    props: {
      interactive: false,
      taskItem: {
        schedule: { isRecurring: false, date, time, string: date },
        duration: null,
        completed: false
      },
      params: { mode: 'multi-line' },
      displaySchedule: false
    }
  });
}

describe('Schedule hybrid display', () => {
  it('shows exact midnight relatively and exposes the exact instant in its title', () => {
    const { container } = renderSchedule('2026-07-11', '00:00');
    const chip = container.querySelector('.task-card-schedule-container')!;
    expect(chip.textContent).toContain('in 5 hours');
    expect(chip).toHaveAttribute('title', 'Sat, Jul 11 · 12:00 AM');
  });

  it('shows far exact times absolutely', () => {
    const { container } = renderSchedule('2026-07-16', '09:00');
    expect(container.textContent).toContain('Thu, Jul 16 · 9:00 AM');
  });

  it('shows day-only tomorrow as Tomorrow and keeps it neutral', () => {
    const { container } = renderSchedule('2026-07-11');
    const chip = container.querySelector('.task-card-schedule-container')!;
    expect(chip.textContent).toContain('Tomorrow');
    expect(chip.classList.contains('day-only')).toBe(true);
    expect(chip.classList.contains('passSchedule')).toBe(false);
  });

  it('keeps the compact live card click-to-expand instead of opening the editor', async () => {
    const schedule = {
      isRecurring: false,
      date: '2026-07-11',
      string: '2026-07-11'
    };
    const syncManager = {
      obsidianTask: {
        schedule,
        duration: null,
        completed: false,
        hasSchedule: () => true
      },
      taskCardStatus: { scheduleStatus: 'done' },
      getTaskCardStatus(key: string) {
        return (this.taskCardStatus as any)[key];
      },
      updateObsidianTaskAttribute: jest.fn()
    };
    const { container } = render(Schedule, {
      props: {
        interactive: true,
        taskSyncManager: syncManager,
        plugin: { taskParser: { parseSchedule: jest.fn() } },
        params: { mode: 'single-line' },
        displaySchedule: true
      }
    });

    await fireEvent.click(container.querySelector('.task-card-schedule-container')!);
    expect(container.querySelector('input.task-card-schedule')).toBeNull();
    expect(syncManager.taskCardStatus.scheduleStatus).toBe('done');
  });
});
