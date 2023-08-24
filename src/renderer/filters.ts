import type { TaskValidator } from '../taskModule/taskValidator';
import { logger } from '../utils/log';

export function isTaskList(el: HTMLElement): boolean {
  // ul, class contains: contains-task-list and has-list-bullet
  if (!el) {
    return false;
  }
  // logger.debug(`isTaskList: el - ${el.innerHTML}, el.tagName - ${el.tagName}, el.classList - ${JSON.stringify(el.classList)}`)
  if (el.tagName !== 'UL') {
    return false;
  }
  return (
    el.classList.contains('contains-task-list') &&
    el.classList.contains('has-list-bullet')
  );
}

export function isTaskItemEl(
  el: HTMLElement,
  taskValidator: TaskValidator
): boolean {
  if (!el) {
    return false;
  }
  if (el.tagName !== 'LI' || el.children.length === 0) {
    return false;
  }
  return taskValidator.isValidTaskElement(el as HTMLElement);
}

/**
 * Filters an array of HTMLElements to return only those that are task items.
 * A task item is defined as an 'LI' element that satisfies the taskValidator criteria.
 *
 * @param elems - An array of HTMLElements to be filtered.
 * @param taskValidator - An object with a method isValidTaskElement to validate task items.
 * @returns An array of HTMLElements that are valid task items.
 */
export function filterTaskItems(
  elems: HTMLElement[],
  taskValidator: TaskValidator
): HTMLElement[] {
  if (
    !Array.isArray(elems) ||
    typeof taskValidator.isValidTaskElement !== 'function'
  ) {
    throw new Error('Invalid input provided.');
  }

  return elems.filter((el) => {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    return (
      el.tagName === 'LI' &&
      el.children.length > 0 &&
      taskValidator.isValidTaskElement(el.children[0] as HTMLElement)
    );
  });
}

/**
 * Returns the indices of elements in an array that satisfy a given filter function.
 *
 * @param array - The array to be filtered.
 * @param filter - A filter function that returns a boolean for each element in the array.
 * @returns An array of indices of elements that satisfy the filter function.
 */
export function getIndicesOfFilter(
  array: any[],
  filter: (element: any) => boolean
): number[] {
  if (!Array.isArray(array) || typeof filter !== 'function') {
    throw new Error('Invalid input provided.');
  }

  const indices: number[] = [];
  array.forEach((element, index) => {
    if (filter(element)) {
      indices.push(index);
    }
  });
  return indices;
}
