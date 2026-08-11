
export function toArray(value: string): string[] {
  if (!value) return [];
  try {
    // If the value is single-quoted, replace with double quotes
    const formattedValue = value.replace(/'/g, '"');
    return JSON.parse(formattedValue);
  } catch {
    throw new Error(`Failed to convert string to array: ${value}`);
  }
}

export function toBoolean(value: string): boolean {
  return value.toLowerCase() === 'true';
}
