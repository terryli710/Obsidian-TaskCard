
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
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts'
  },
  setupFilesAfterEnv: [
    '@testing-library/jest-dom/extend-expect',
    '<rootDir>/tests/setupObsidianDom.ts'
  ],
  // agent worktrees live under .claude/worktrees and carry their own tests/
  testPathIgnorePatterns: ['node_modules', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  transformIgnorePatterns: [
    'node_modules/(?!(svelte)/)' // This will make sure svelte is transformed but other node_modules are not.
  ],
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts']
};