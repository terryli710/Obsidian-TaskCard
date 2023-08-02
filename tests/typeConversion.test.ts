

import { toArray, toBoolean } from '../src/utils/typeConversion';


describe('toArray function', () => {
    test('should convert JSON string to array', () => {
      const value = '["item1", "item2", "item3"]';
      const result = toArray(value);
      expect(result).toEqual(["item1", "item2", "item3"]);
    });

    test('should cover single quote array', () => {
      const value = "['item1', 'item2', 'item3']";
      const result = toArray(value);
      expect(result).toEqual(["item1", "item2", "item3"]);
    });
  
    test('should throw an error for invalid JSON', () => {
      const value = 'not a valid JSON string';
      expect(() => toArray(value)).toThrowError('Failed to convert string to array: not a valid JSON string');
    });
  });
  
  describe('toBoolean function', () => {
    test('should convert "true" string to boolean', () => {
      const value = "true";
      const result = toBoolean(value);
      expect(result).toBe(true);
    });
  
    test('should convert "false" string to boolean', () => {
      const value = "false";
      const result = toBoolean(value);
      expect(result).toBe(false);
    });
  
    test('should convert non-boolean string to false', () => {
      const value = "not a boolean";
      const result = toBoolean(value);
      expect(result).toBe(false);
    });
  });