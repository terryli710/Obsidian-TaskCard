module.exports = {
    preset: 'ts-jest/presets/js-with-ts',
    testEnvironment: 'jest-environment-node',
    verbose: true,
    transform: {
        '^.+\\.svelte$': 'svelte-jester',
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
      },
    moduleFileExtensions: ['js', 'svelte', 'ts'],
    setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
    testPathIgnorePatterns: ['node_modules'],
    transformIgnorePatterns: ['node_modules'],
    clearMocks: true,
    extensionsToTreatAsEsm: ['.ts'],
};