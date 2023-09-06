
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'jest-environment-node',
  verbose: true,
  transform: {
    '^.+\\.svelte$': ['svelte-jester', { preprocess: true }],
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'esbuild-jest'
  },
  moduleFileExtensions: ['js', 'svelte', 'ts'],
  setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
  testPathIgnorePatterns: ['node_modules'],
  transformIgnorePatterns: [
    'node_modules/(?!(svelte)/)' // This will make sure svelte is transformed but other node_modules are not.
  ],
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts']
};