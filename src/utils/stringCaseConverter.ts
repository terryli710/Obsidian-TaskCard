// List of special words
const specialWords = ['ID'];

// Helper function to convert camelCase to kebab-case
export function camelToKebab(camelCase: string) {
    let word = camelCase;

    // Preserve special words
    for (let specialWord of specialWords) {
        word = word.replace(new RegExp(specialWord, 'g'), `-${specialWord}`);
    }

    return word.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

// Helper function to convert kebab-case to camelCase
export function kebabToCamel(kebabCase: string) {
    let word = kebabCase;

    // Preserve special words
    for (let specialWord of specialWords) {
        word = word.replace(new RegExp(`-${specialWord}`, 'g'), specialWord);
    }

    return word.replace(/-([a-z])/g, g => g[1].toUpperCase());
}