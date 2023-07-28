import { camelToKebab, kebabToCamel } from '../src/utils/stringCaseConverter';

describe('string case conversion', () => {
  test('camelToKebab should convert camelCase to kebab-case', () => {
    expect(camelToKebab('camelCaseString')).toBe('camel-case-string');
    expect(camelToKebab('specialCaseID')).toBe('special-case-id');
    // add more test cases as needed
  });

  test('kebabToCamel should convert kebab-case to camelCase', () => {
    expect(kebabToCamel('kebab-case-string')).toBe('kebabCaseString');
    expect(kebabToCamel('special-case-id')).toBe('specialCaseID');
    // add more test cases as needed
  });
});