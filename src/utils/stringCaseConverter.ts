// List of special words
const specialWords = ['ID', 'API'];

// Helper function to convert camelCase to kebab-case
export function camelToKebab(camelCase: string) {
    let result = camelCase;

    // Replace special words first
    for (let specialWord of specialWords) {
        const regex = new RegExp(specialWord, 'g');
        result = result.replace(regex, `-${specialWord.toLowerCase()}`);
    }

    // Replace rest of the uppercase letters
    result = result.replace(/([A-Z])/g, letter => `-${letter.toLowerCase()}`);

    // If the string starts with a hyphen, remove it
    result = result.replace(/^-/, '');

    return result;
}

// Helper function to convert kebab-case to camelCase
export function kebabToCamel(kebabCase: string) {
    let result = kebabCase;

    // Replace special words first
    for (let specialWord of specialWords) {
        const regex = new RegExp(`-${specialWord.toLowerCase()}`, 'g');
        result = result.replace(regex, specialWord);
    }

    // Replace rest of the hyphenated letters
    result = result.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

    return result;
}