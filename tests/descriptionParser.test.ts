/** @jest-environment jsdom */

import { DescriptionParser } from '../src/taskModule/description';

// NOTE: the obsidian mock (tests/__mocks__/obsidian.ts) provides a simplified
// htmlToMarkdown that turns <li> into "- " lines and strips all other tags.
// Markdown assertions below are written against that mock, not the real
// Obsidian converter.

function createTaskElement(innerHTML: string): HTMLElement {
  const li = document.createElement('li');
  li.className = 'task-list-item';
  li.innerHTML = innerHTML;
  return li;
}

describe('DescriptionParser', () => {
  describe('extractListEls', () => {
    it('should return an empty array for a null task element', () => {
      const result = DescriptionParser.extractListEls(
        null as unknown as HTMLElement
      );
      expect(result).toEqual([]);
    });

    it('should return an empty array when the task element has no lists', () => {
      const taskElement = createTaskElement('Just some task content');
      expect(DescriptionParser.extractListEls(taskElement)).toEqual([]);
    });

    it('should extract ul and ol elements in document order', () => {
      const taskElement = createTaskElement(
        'Task content' +
          '<ul><li>alpha</li></ul>' +
          '<ol><li>beta</li></ol>'
      );
      const result = DescriptionParser.extractListEls(taskElement);
      expect(result).toHaveLength(2);
      expect(result[0].tagName).toBe('UL');
      expect(result[1].tagName).toBe('OL');
    });

    it('should return only top-level lists, not their nested descendants', () => {
      const taskElement = createTaskElement(
        'Task content<ul><li>parent<ul><li>child</li></ul></li></ul>'
      );
      const result = DescriptionParser.extractListEls(taskElement);
      // the nested <ul> is serialized as part of its parent, so only the
      // outer list is returned
      expect(result).toHaveLength(1);
      expect(result[0].tagName).toBe('UL');
      expect(result[0].querySelector('ul')).not.toBeNull();
    });
  });

  describe('parseDescriptionFromTaskEl', () => {
    it('should return an empty string when there is no description list', () => {
      const taskElement = createTaskElement('A task without description');
      expect(DescriptionParser.parseDescriptionFromTaskEl(taskElement)).toBe(
        ''
      );
    });

    // No trailing newline: a description ending in "\n" made the formatter
    // emit a dangling indented blank line below the task on every rewrite
    // (one extra line accumulated per card edit).
    it('should convert a single ul into markdown list lines', () => {
      const taskElement = createTaskElement(
        'Task content<ul><li>item one</li><li>item two</li></ul>'
      );
      const result = DescriptionParser.parseDescriptionFromTaskEl(taskElement);
      expect(result).toBe('- item one\n- item two');
    });

    it('should convert an ol the same way as a ul (mock renders "- " bullets)', () => {
      const taskElement = createTaskElement(
        'Task content<ol><li>first</li><li>second</li></ol>'
      );
      const result = DescriptionParser.parseDescriptionFromTaskEl(taskElement);
      expect(result).toBe('- first\n- second');
    });

    it('should concatenate multiple sibling lists, keeping the separator newline between them', () => {
      const taskElement = createTaskElement(
        'Task content' +
          '<ul><li>alpha</li></ul>' +
          '<ol><li>beta</li></ol>'
      );
      const result = DescriptionParser.parseDescriptionFromTaskEl(taskElement);
      expect(result).toBe('- alpha\n- beta');
    });

    it('should include nested list content exactly once', () => {
      const taskElement = createTaskElement(
        'Task content<ul><li>parent<ul><li>child</li></ul></li></ul>'
      );
      const result = DescriptionParser.parseDescriptionFromTaskEl(taskElement);
      // only the outer list is converted (the mock converter flattens the
      // nested list into its parent), so "child" appears exactly once
      expect(result).toBe('- parent- child');
    });
  });

  describe('progressOfDescription', () => {
    it('should return [0, 0] for an empty description', () => {
      expect(DescriptionParser.progressOfDescription('')).toEqual([0, 0]);
    });

    it('should return [0, 0] for a whitespace-only description', () => {
      expect(DescriptionParser.progressOfDescription('   \n\t  ')).toEqual([
        0, 0
      ]);
    });

    it('should return [0, 0] when there are no checkboxes', () => {
      const description = 'Just a paragraph\n- a plain bullet without checkbox';
      expect(DescriptionParser.progressOfDescription(description)).toEqual([
        0, 0
      ]);
    });

    it('should count unchecked and checked tasks', () => {
      const description = '- [ ] first\n- [x] second\n- [ ] third';
      expect(DescriptionParser.progressOfDescription(description)).toEqual([
        1, 3
      ]);
    });

    it('should count all checkboxes as finished when all are checked', () => {
      const description = '- [x] first\n- [x] second';
      expect(DescriptionParser.progressOfDescription(description)).toEqual([
        2, 2
      ]);
    });

    it('should count nested (indented) checkboxes, including tab indentation', () => {
      const description =
        '- [ ] parent\n    - [x] indented child\n\t- [ ] tab-indented child';
      expect(DescriptionParser.progressOfDescription(description)).toEqual([
        1, 3
      ]);
    });

    it('should count only [x]/[X] as finished, not other markers', () => {
      // non-standard markers such as [-] count toward the total but not as done
      const description = '- [X] shouting done\n- [-] cancelled\n- [ ] open';
      expect(DescriptionParser.progressOfDescription(description)).toEqual([
        1, 3
      ]);
    });

    it('should count a bare checkbox at the end of the description as an open task', () => {
      const description = '- [ ] real task\n- [ ]';
      expect(DescriptionParser.progressOfDescription(description)).toEqual([
        0, 2
      ]);
    });

    it('should count each line independently (bare checkbox cannot swallow the next line)', () => {
      // the regex is per-line now: a bare "- [ ]" counts as one open task and
      // the following "- [x] done" line is still counted as finished
      expect(
        DescriptionParser.progressOfDescription('- [ ]\n- [x] done')
      ).toEqual([1, 2]);
    });

    it('should ignore non-checkbox lines mixed into the description', () => {
      const description =
        'intro text\n- [ ] a task\nsome note\n- [x] done task\n- bullet';
      expect(DescriptionParser.progressOfDescription(description)).toEqual([
        1, 2
      ]);
    });
  });
});
