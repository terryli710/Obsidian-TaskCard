


import { isTaskList, isTaskItemEl, filterTaskItems, getIndicesOfFilter } from '../src/renderer/filters';

import { JSDOM } from 'jsdom';

const { window } = new JSDOM('');
const { document } = window;
global.HTMLElement = window.HTMLElement;

// Mocking TaskValidator's isValidTaskElement function
jest.mock('../src/taskModule/taskValidator', () => {
    return {
        isValidTaskElement: jest.fn()
    };
});

const mockValidator = {
    isValidTaskElement: jest.fn()
};

// Test for isTaskList

describe('isTaskList', () => {
    it('should return false for null or undefined elements', () => {
        expect(isTaskList(null)).toBe(false);
        expect(isTaskList(undefined)).toBe(false);
    });

    it('should return false for non-UL elements', () => {
        const div = document.createElement('div');
        expect(isTaskList(div)).toBe(false);
    });

    it('should return true for UL elements with correct classes', () => {
        const ul = document.createElement('ul');
        ul.classList.add('contains-task-list', 'has-list-bullet');
        expect(isTaskList(ul)).toBe(true);
    });

    it('should return false for UL elements without correct classes', () => {
        const ul = document.createElement('ul');
        ul.classList.add('contains-task-list');
        expect(isTaskList(ul)).toBe(false);
    });
});

// Test for isTaskItemEl

describe('isTaskItemEl', () => {
    beforeEach(() => {
        mockValidator.isValidTaskElement.mockReturnValue(true);
    });

    it('should return false for null or undefined elements', () => {
        expect(isTaskItemEl(null, mockValidator as any)).toBe(false);
        expect(isTaskItemEl(undefined, mockValidator as any)).toBe(false);
    });

    it('should return false for non-LI elements', () => {
        const div = document.createElement('div');
        expect(isTaskItemEl(div, mockValidator as any)).toBe(false);
    });

    it('should return true for LI elements with valid task', () => {
        const li = document.createElement('li');
        const task = document.createElement('div');
        li.appendChild(task);
        expect(isTaskItemEl(li, mockValidator as any)).toBe(true);
    });

    it('should return false for LI elements without valid task', () => {
        mockValidator.isValidTaskElement.mockReturnValue(false);
        const li = document.createElement('li');
        const task = document.createElement('div');
        li.appendChild(task);
        expect(isTaskItemEl(li, mockValidator as any)).toBe(false);
    });
});

// Test for filterTaskItems

describe('filterTaskItems', () => {
    beforeEach(() => {
        mockValidator.isValidTaskElement.mockReturnValue(true);
    });

    it('should throw error for invalid inputs', () => {
        expect(() => filterTaskItems('string', mockValidator)).toThrow('Invalid input provided.');
        expect(() => filterTaskItems([], 'string')).toThrow('Invalid input provided.');
    });

    it('should return valid task items', () => {
        const li1 = document.createElement('li');
        const task1 = document.createElement('div');
        li1.appendChild(task1);

        const li2 = document.createElement('li');

        const elems = [li1, li2];
        const result = filterTaskItems(elems, mockValidator as any);
        expect(result.length).toBe(1);
        expect(result[0]).toBe(li1);
    });
});

// Test for getIndicesOfFilter

describe('getIndicesOfFilter', () => {
    it('should throw error for invalid inputs', () => {
        expect(() => getIndicesOfFilter('string', () => true)).toThrow('Invalid input provided.');
        expect(() => getIndicesOfFilter([], 'string')).toThrow('Invalid input provided.');
    });

    it('should return indices of elements satisfying the filter', () => {
        const array = [1, 2, 3, 4, 5];
        const filter = (num) => num % 2 === 0;
        const result = getIndicesOfFilter(array, filter);
        expect(result).toEqual([1, 3]);
    });
});
