

export function toArray(value: string): string[] {
    try {
      // Assuming that the array is in JSON format
      return JSON.parse(value);
    } catch (e) {
      throw new Error(`Failed to convert string to array: ${value}`);
    }
}

export function toBoolean(value: string): boolean {
    return value.toLowerCase() === 'true';
}