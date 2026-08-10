/** @jest-environment jsdom */
/**
 * Extra coverage for src/renderer/filters.ts beyond tests/filter.test.ts:
 * class-combination cases for isTaskList, childless/validator-argument cases
 * for isTaskItemEl, input validation + mixed inputs for filterTaskItems, and
 * degenerate inputs for getIndicesOfFilter.
 */
import {
  isTaskList,
  isTaskItemEl,
  filterTaskItems,
  getIndicesOfFilter
} from '../src/renderer/filters';

function makeValidator(result = true) {
  return { isValidTaskElement: jest.fn(() => result) } as any;
}

function taskLi(): HTMLLIElement {
  const li = document.createElement('li');
  li.appendChild(document.createElement('div'));
  return li;
}

describe('isTaskList (class combinations)', () => {
  it('requires BOTH task-list classes, not just one', () => {
    const onlyBullet = document.createElement('ul');
    onlyBullet.classList.add('has-list-bullet');
    expect(isTaskList(onlyBullet)).toBe(false);

    const onlyTaskList = document.createElement('ul');
    onlyTaskList.classList.add('contains-task-list');
    expect(isTaskList(onlyTaskList)).toBe(false);

    const none = document.createElement('ul');
    expect(isTaskList(none)).toBe(false);
  });

  it('tolerates extra classes as long as both required ones are present', () => {
    const ul = document.createElement('ul');
    ul.classList.add(
      'markdown-rendered',
      'contains-task-list',
      'has-list-bullet',
      'custom'
    );
    expect(isTaskList(ul)).toBe(true);
  });

  it('rejects an OL even with the right classes (UL only)', () => {
    const ol = document.createElement('ol');
    ol.classList.add('contains-task-list', 'has-list-bullet');
    expect(isTaskList(ol as unknown as HTMLElement)).toBe(false);
  });
});

describe('isTaskItemEl (children and validator wiring)', () => {
  it('rejects an LI with no children even if the validator would pass', () => {
    const validator = makeValidator(true);
    const li = document.createElement('li');
    expect(isTaskItemEl(li, validator)).toBe(false);
    expect(validator.isValidTaskElement).not.toHaveBeenCalled();
  });

  it('passes the LI element itself to the validator', () => {
    const validator = makeValidator(true);
    const li = taskLi();
    isTaskItemEl(li, validator);
    expect(validator.isValidTaskElement).toHaveBeenCalledWith(li);
  });
});

describe('filterTaskItems (validation and mixed inputs)', () => {
  it('throws on non-array input', () => {
    expect(() =>
      filterTaskItems('not-an-array' as any, makeValidator())
    ).toThrow('Invalid input provided.');
  });

  it('throws when the validator has no isValidTaskElement function', () => {
    expect(() => filterTaskItems([], {} as any)).toThrow(
      'Invalid input provided.'
    );
  });

  it('returns [] for an empty element list', () => {
    expect(filterTaskItems([], makeValidator())).toEqual([]);
  });

  it('drops entries that are not HTMLElements', () => {
    const validator = makeValidator(true);
    const li = taskLi();
    const elems = [li, null, undefined, 42, 'li', {}] as any[];
    expect(filterTaskItems(elems, validator)).toEqual([li]);
  });

  it('drops non-LI elements and childless LIs, keeps valid LIs', () => {
    const validator = makeValidator(true);
    const good = taskLi();
    const div = document.createElement('div');
    div.appendChild(document.createElement('div'));
    const childless = document.createElement('li');

    expect(filterTaskItems([good, div, childless], validator)).toEqual([good]);
  });

  it('drops LIs whose first child fails validation', () => {
    const validator = makeValidator();
    validator.isValidTaskElement
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    const li1 = taskLi();
    const li2 = taskLi();

    expect(filterTaskItems([li1, li2], validator)).toEqual([li1]);
  });

  it('validates the FIRST CHILD of each LI (not the LI itself)', () => {
    const validator = makeValidator(true);
    const li = taskLi();
    filterTaskItems([li], validator);
    expect(validator.isValidTaskElement).toHaveBeenCalledWith(
      li.children[0]
    );
  });

  it('returns [] when every element fails validation', () => {
    const validator = makeValidator(false);
    expect(filterTaskItems([taskLi(), taskLi()], validator)).toEqual([]);
  });
});

describe('getIndicesOfFilter (degenerate inputs)', () => {
  it('throws on non-array input', () => {
    expect(() => getIndicesOfFilter('nope' as any, () => true)).toThrow(
      'Invalid input provided.'
    );
  });

  it('throws on a non-function filter', () => {
    expect(() => getIndicesOfFilter([1, 2], 'nope' as any)).toThrow(
      'Invalid input provided.'
    );
  });

  it('returns [] for an empty array', () => {
    expect(getIndicesOfFilter([], () => true)).toEqual([]);
  });

  it('returns [] when nothing matches', () => {
    expect(getIndicesOfFilter([1, 2, 3], () => false)).toEqual([]);
  });

  it('a criteria-less (always true) filter returns every index', () => {
    expect(getIndicesOfFilter(['a', 'b', 'c'], () => true)).toEqual([
      0, 1, 2
    ]);
  });

  it('works over heterogeneous arrays including falsy entries', () => {
    const arr = [0, '', null, 'task', undefined, false, 7];
    expect(getIndicesOfFilter(arr, (x) => !x)).toEqual([0, 1, 2, 4, 5]);
    expect(getIndicesOfFilter(arr, (x) => typeof x === 'number')).toEqual([
      0, 6
    ]);
  });
});
