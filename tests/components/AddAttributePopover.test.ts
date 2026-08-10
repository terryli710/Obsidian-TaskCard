/** @jest-environment jsdom */

import '@testing-library/jest-dom';

function mockIconModule(moduleName: string, iconName: string) {
  const internal = require('svelte/internal');

  function createMockIcon(name: string) {
    function instance($$self: any, $$props: any, $$invalidate: any) {
      let { ariaLabel = name } = $$props;

      $$self.$$set = ($$nextProps: any) => {
        if ('ariaLabel' in $$nextProps) $$invalidate(0, (ariaLabel = $$nextProps.ariaLabel));
      };

      return [ariaLabel];
    }

    function create_fragment(ctx: any) {
      let span: HTMLElement;

      return {
        c() {
          span = internal.element('span');
          internal.attr(span, 'data-mock-icon', ctx[0]);
        },
        m(target: HTMLElement, anchor: HTMLElement | null) {
          internal.insert(target, span, anchor);
        },
        p(ctx: any, [dirty]: [number]) {
          if (dirty & 1) {
            internal.attr(span, 'data-mock-icon', ctx[0]);
          }
        },
        d(detaching: boolean) {
          if (detaching) internal.detach(span);
        }
      };
    }

    return class MockIcon extends internal.SvelteComponent {
      constructor(options: any) {
        super();
        internal.init(this, options, instance, create_fragment, internal.safe_not_equal, {
          ariaLabel: 0
        });
      }
    };
  }

  jest.mock(moduleName, () => createMockIcon(iconName), { virtual: true });
}

mockIconModule(
  'lucide-svelte/dist/svelte/icons/calendar-clock.svelte',
  'calendar-clock'
);
mockIconModule(
  'lucide-svelte/dist/svelte/icons/calendar-x.svelte',
  'calendar-x'
);
mockIconModule('lucide-svelte/dist/svelte/icons/flag.svelte', 'flag');
mockIconModule('lucide-svelte/dist/svelte/icons/folder.svelte', 'folder');
mockIconModule(
  'lucide-svelte/dist/svelte/icons/hourglass.svelte',
  'hourglass'
);
mockIconModule('lucide-svelte/dist/svelte/icons/plus.svelte', 'plus');
mockIconModule('lucide-svelte/dist/svelte/icons/repeat.svelte', 'repeat');
mockIconModule('lucide-svelte/dist/svelte/icons/tag.svelte', 'tag');
mockIconModule('lucide-svelte/dist/svelte/icons/text.svelte', 'text');

import { DefaultSettings, SettingStore } from '../../src/settings';
import { fireEvent, loadSvelte, render, screen, srcPath } from './testUtils';

let AddAttributePopover: any;

beforeAll(async () => {
  AddAttributePopover = await loadSvelte(srcPath('ui/AddAttributePopover.svelte'));
});

beforeEach(() => {
  SettingStore.set({
    ...DefaultSettings,
    userMetadata: {
      ...DefaultSettings.userMetadata,
      projects: [
        { id: 'work', name: 'Work', color: '#5b8def' },
        { id: 'home', name: 'Home', color: '#68b984' }
      ]
    }
  });
});

function makeTask(options: {
  due?: boolean;
  schedule?: boolean;
  recurrence?: boolean;
  duration?: boolean;
  priority?: 1 | 2 | 3 | 4;
  project?: boolean;
  labels?: boolean;
  description?: boolean;
} = {}) {
  return {
    priority: options.priority ?? 4,
    hasDue: () => options.due ?? false,
    hasSchedule: () => options.schedule ?? false,
    hasRecurrence: () => options.recurrence ?? false,
    hasDuration: () => options.duration ?? false,
    hasProject: () => options.project ?? false,
    hasAnyLabels: () => options.labels ?? false,
    hasDescription: () => options.description ?? false
  };
}

function renderPopover(task = makeTask()) {
  return render(AddAttributePopover, {
    props: {
      task,
      onStartEditing: jest.fn(),
      onSetPriority: jest.fn(),
      onOpenProjectPicker: jest.fn(),
      onAddLabel: jest.fn()
    }
  });
}

describe('AddAttributePopover', () => {
  test('shows only missing attributes in the decided order', async () => {
    const { container } = renderPopover(
      makeTask({ due: true, labels: true, project: false, description: false })
    );

    await fireEvent.click(
      screen.getByRole('button', { name: 'Add attribute' })
    );

    const rows = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.task-card-add-attribute-row')
    ).map((row) => row.textContent!.trim());

    expect(rows).toEqual([
      'Scheduled',
      'Repeat',
      'Duration',
      'Priority',
      'Project',
      'Description'
    ]);
    expect(rows).not.toContain('Due');
    expect(rows).not.toContain('Label');
  });

  test('priority selection calls the update path with the mapped value', async () => {
    const onSetPriority = jest.fn();
    render(AddAttributePopover, {
      props: {
        task: makeTask(),
        onStartEditing: jest.fn(),
        onSetPriority,
        onOpenProjectPicker: jest.fn(),
        onAddLabel: jest.fn()
      }
    });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Add attribute' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Priority' }));
    // spec scale (docs/format-spec.md): high ↔ 2
    await fireEvent.click(screen.getByRole('button', { name: 'High' }));

    expect(onSetPriority).toHaveBeenCalledWith(2);
    expect(screen.queryByTestId('add-attribute-popover')).toBeNull();
  });

  test('project selection opens the picker and closes the popover instead of listing projects', async () => {
    const onOpenProjectPicker = jest.fn();
    render(AddAttributePopover, {
      props: {
        task: makeTask(),
        onStartEditing: jest.fn(),
        onSetPriority: jest.fn(),
        onOpenProjectPicker,
        onAddLabel: jest.fn()
      }
    });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Add attribute' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Project' }));

    expect(onOpenProjectPicker).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('add-attribute-popover')).toBeNull();
  });

  test('project selection with no projects available shows a Notice and does not open the picker', async () => {
    SettingStore.set({
      ...DefaultSettings,
      userMetadata: { ...DefaultSettings.userMetadata, projects: [] }
    });
    const onOpenProjectPicker = jest.fn();
    render(AddAttributePopover, {
      props: {
        task: makeTask(),
        onStartEditing: jest.fn(),
        onSetPriority: jest.fn(),
        onOpenProjectPicker,
        onAddLabel: jest.fn()
      }
    });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Add attribute' })
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Project' }));

    expect(onOpenProjectPicker).not.toHaveBeenCalled();
    expect(screen.queryByTestId('add-attribute-popover')).toBeNull();
  });

  test('closes on outside interaction', async () => {
    renderPopover();

    await fireEvent.click(
      screen.getByRole('button', { name: 'Add attribute' })
    );
    expect(screen.getByTestId('add-attribute-popover')).toBeInTheDocument();

    await fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId('add-attribute-popover')).toBeNull();
  });
});
