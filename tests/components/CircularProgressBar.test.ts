/** @jest-environment jsdom */

/**
 * Component tests for src/components/CircularProgressBar.svelte
 *
 * Pure visual component: renders an SVG donut whose second <path> encodes the
 * progress (value/max) plus an optional "value/max" digit readout.
 */
import '@testing-library/jest-dom';
import { loadSvelte, render, screen, srcPath } from './testUtils';

let CircularProgressBar: any;

beforeAll(async () => {
  CircularProgressBar = await loadSvelte(
    srcPath('components/CircularProgressBar.svelte')
  );
});

const FULL_CIRCLE_PATH = 'M50,5A45 45 0 1 1 49.9999 5';

function getPaths(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll('svg path'));
}

describe('CircularProgressBar', () => {
  test('renders background track and empty progress path at value=0', () => {
    const { container } = render(CircularProgressBar, {
      props: { value: 0, max: 5 }
    });

    const paths = getPaths(container);
    expect(paths).toHaveLength(2);
    // first path is the static full-circle track
    expect(paths[0].getAttribute('d')).toBe(FULL_CIRCLE_PATH);
    // no progress -> empty path
    expect(paths[1].getAttribute('d')).toBe('');
    expect(screen.getByText('0/5')).toBeInTheDocument();
  });

  test('renders full circle when value reaches max', () => {
    const { container } = render(CircularProgressBar, {
      props: { value: 5, max: 5 }
    });

    const paths = getPaths(container);
    expect(paths[1].getAttribute('d')).toBe(FULL_CIRCLE_PATH);
    expect(screen.getByText('5/5')).toBeInTheDocument();
  });

  test('renders partial arc for progress below half (no midpoint arc segment)', () => {
    const { container } = render(CircularProgressBar, {
      props: { value: 1, max: 4 }
    });

    const d = getPaths(container)[1].getAttribute('d')!;
    expect(d.startsWith('M50,5')).toBe(true);
    // 25% -> angle < PI, so the bottom midpoint segment must not be present
    expect(d).not.toContain('A45 45 0 0 1 50 95');
    // 25% of the circle ends at (95, 50)
    expect(d).toMatch(/A45 45 0 0 1 95 50/);
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  test('renders arc through bottom midpoint for progress above half', () => {
    const { container } = render(CircularProgressBar, {
      props: { value: 3, max: 4 }
    });

    const d = getPaths(container)[1].getAttribute('d')!;
    // 75% -> angle > PI, path routes through the bottom midpoint (50, 95)
    expect(d).toContain('A45 45 0 0 1 50 95');
    // and ends at the 270-degree point (5, 50) -- allow float rounding noise
    expect(d).toMatch(/A45 45 0 0 1 5 50(\.\d+)?$/);
  });

  test('hides the digit readout when showDigits is false', () => {
    const { container } = render(CircularProgressBar, {
      props: { value: 2, max: 3, showDigits: false }
    });

    expect(container.querySelector('.digit')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
