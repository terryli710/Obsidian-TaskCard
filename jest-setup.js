jest.mock('obsidian', () => ({
    Notice: jest.fn().mockImplementation((message) => console.log(`Mock Notice: ${message}`))
}));