import { camelToKebab, kebabToCamel } from '../src/utils/stringCaseConverter';

describe('string case conversion', () => {
  test('camelToKebab should convert camelCase to kebab-case', () => {
      expect(camelToKebab('camelCaseString')).toBe('camel-case-string');
      expect(camelToKebab('specialCaseID')).toBe('special-case-id');
      expect(camelToKebab('anotherCamelCaseString')).toBe('another-camel-case-string');
      expect(camelToKebab('someIDInString')).toBe('some-id-in-string');
  });

  test('kebabToCamel should convert kebab-case to camelCase', () => {
      expect(kebabToCamel('kebab-case-string')).toBe('kebabCaseString');
      expect(kebabToCamel('special-case-id')).toBe('specialCaseID');
      expect(kebabToCamel('another-kebab-case-string')).toBe('anotherKebabCaseString');
      expect(kebabToCamel('some-id-in-string')).toBe('someIDInString');
  });
});