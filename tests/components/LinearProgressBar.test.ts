/** @jest-environment jsdom */

/**
 * Component tests for src/components/LinearProgressBar.svelte
 *
 * Pure visual component: a background <rect> plus a fill <rect> whose width
 * is (value/max) * barLength, with optional digits.
 */
import '@testing-library/jest-dom';
import { loadSvelte, render, screen, srcPath } from './testUtils';

let LinearProgressBar: any;

beforeAll(async () => {
  LinearProgressBar = await loadSvelte(
    srcPath('components/LinearProgressBar.svelte')
  );
});

function getRects(container: HTMLElement): SVGRectElement[] {
  return Array.from(container.querySelectorAll('svg rect'));
}

describe('LinearProgressBar', () => {
  test('zero progress renders a zero-width fill rect over the full track', () => {
    const { container } = render(LinearProgressBar, {
      props: { value: 0, max: 10 }
    });

    const [track, fill] = getRects(container);
    expect(track.getAttribute('width')).toBe('100'); // default barLength
    expect(fill.getAttribute('width')).toBe('0');
    expect(screen.getByText('0/10')).toBeInTheDocument();
  });

  test('partial progress scales the fill rect width by value/max', () => {
    const { container } = render(LinearProgressBar, {
      props: { value: 1, max: 4 }
    });

    const [, fill] = getRects(container);
    expect(fill.getAttribute('width')).toBe('25'); // (1/4) * 100
  });

  test('value at or above max clamps the fill to barLength', () => {
    const { container } = render(LinearProgressBar, {
      props: { value: 12, max: 10 }
    });

    const [, fill] = getRects(container);
    expect(fill.getAttribute('width')).toBe('100');
  });

  test('respects custom barLength, fillColor and borderRadius', () => {
    const { container } = render(LinearProgressBar, {
      props: {
        value: 1,
        max: 2,
        barLength: 200,
        fillColor: 'rgb(1, 2, 3)',
        borderRadius: 9
      }
    });

    const [track, fill] = getRects(container);
    expect(track.getAttribute('width')).toBe('200');
    expect(fill.getAttribute('width')).toBe('100'); // half of 200
    expect(fill.getAttribute('fill')).toBe('rgb(1, 2, 3)');
    expect(fill.getAttribute('rx')).toBe('9');
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe(
      '0 0 200 10'
    );
    const svgContainer = container.querySelector(
      '.svg-container'
    ) as HTMLElement;
    expect(svgContainer.style.width).toBe('200px');
  });

  test('hides the digit readout when showDigits is false', () => {
    const { container } = render(LinearProgressBar, {
      props: { value: 1, max: 2, showDigits: false }
    });

    expect(container.querySelector('.digit')).toBeNull();
    expect(getRects(container)).toHaveLength(2);
  });
});
