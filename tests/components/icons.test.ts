/** @jest-environment jsdom */

/**
 * Component tests for the icon components in src/components/icons/.
 *
 * LucideIcon is the shared SVG shell (props + DOM event forwarding); the
 * named icons (Plus, AlertTriangle, ...) wrap it with a fixed path.
 */
import '@testing-library/jest-dom';
import { fireEvent, loadSvelte, render, srcPath } from './testUtils';

let LucideIcon: any;
let Plus: any;
let AlertTriangle: any;

beforeAll(async () => {
  LucideIcon = await loadSvelte(srcPath('components/icons/LucideIcon.svelte'));
  Plus = await loadSvelte(srcPath('components/icons/Plus.svelte'));
  AlertTriangle = await loadSvelte(
    srcPath('components/icons/AlertTriangle.svelte')
  );
});

describe('LucideIcon', () => {
  test('renders an svg with default size, role and aria-label', () => {
    const { container } = render(LucideIcon, {});

    const svg = container.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('icon');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  test('applies custom props: size, color, strokeWidth, box, class and svgPath', () => {
    const { container } = render(LucideIcon, {
      props: {
        width: '14',
        height: '14',
        color: 'red',
        strokeWidth: '3',
        box: 48,
        ariaLabel: 'my-icon',
        svgPath: '<path d="M1 1L2 2"/>',
        class: 'task-card-icon extra'
      }
    });

    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('stroke')).toBe('red');
    expect(svg.getAttribute('stroke-width')).toBe('3');
    expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
    expect(svg.getAttribute('aria-label')).toBe('my-icon');
    expect(svg.getAttribute('class')).toBe('task-card-icon extra');
    // {@html svgPath} injects the raw path markup
    const path = svg.querySelector('path')!;
    expect(path.getAttribute('d')).toBe('M1 1L2 2');
  });

  test('forwards DOM events (on:click) to component listeners', async () => {
    const { container, component } = render(LucideIcon, {});
    const clicks: Event[] = [];
    component.$on('click', (event) => clicks.push(event));

    await fireEvent.click(container.querySelector('svg')!);

    expect(clicks).toHaveLength(1);
    expect(clicks[0].type).toBe('click');
  });
});

describe('named icons', () => {
  test('Plus renders its two paths with default aria-label "plus"', () => {
    const { container } = render(Plus, {});

    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBe('plus');
    expect(svg.getAttribute('class')).toBe('task-card-icon');
    const ds = Array.from(svg.querySelectorAll('path')).map((p) =>
      p.getAttribute('d')
    );
    expect(ds).toEqual(['M5 12h14', 'M12 5v14']);
  });

  test('AlertTriangle passes width/height/ariaLabel through to the svg', () => {
    const { container } = render(AlertTriangle, {
      props: { width: '14', height: '14', ariaLabel: 'Due' }
    });

    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('height')).toBe('14');
    expect(svg.getAttribute('aria-label')).toBe('Due');
    expect(svg.querySelectorAll('path')).toHaveLength(3);
  });

  test('AlertTriangle default aria-label matches the icon', () => {
    const { container } = render(AlertTriangle, {});
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBe('alert-triangle');
  });
});
