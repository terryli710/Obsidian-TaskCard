import { camelToKebab, kebabToCamel, toCamelCase } from '../src/utils/stringCaseConverter';

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

  test('toCamelCase should convert a word + space structure to camelCase', () => {
      expect(toCamelCase('hello')).toBe('hello');
      expect(toCamelCase('Hello World')).toBe('helloWorld');
      expect(toCamelCase('The Quick Brown Fox')).toBe('theQuickBrownFox');
      expect(toCamelCase(' The pretty brown fox ')).toBe('thePrettyBrownFox');
      expect(toCamelCase('   The    Slow   Brown   Fox   ')).toBe('theSlowBrownFox');
      expect(toCamelCase('')).toBe('');
    });
});