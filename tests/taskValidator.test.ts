


import { writable } from 'svelte/store';
import { TaskValidator } from '../src/taskModule/taskValidator';  // Update this to the correct import path
import { logger } from '../src/log';

describe('TaskValidator', () => {
    let mockSettingStore;
    let taskValidator;

    beforeEach(() => {
        // Mock the SettingStore with controlled settings
        mockSettingStore = writable({
            parsingSettings: {
                indicatorTag: 'TaskCard',
                markdownStartingNotation: '%%*',
                markdownEndingNotation: '*%%'
            }
        });

        taskValidator = new TaskValidator(mockSettingStore);
    });

    describe('isValidFormattedTaskMarkdown', () => {

        it('should validate correctly formatted task markdown', () => {
            // const formattedTaskRaw = `
            // - [ ] An example task #TaskCard 
            // <span class="priority" style="display:none;">4</span> 
            // <span class="description" style="display:none;">"- A multi line description.\n- the second line."</span> 
            // <span class="order" style="display:none;">1</span> 
            // <span class="project" style="display:none;">{"id":"project-123", "name":"Project Name"}</span> 
            // <span class="section-id" style="display:none;">"section-456"</span> 
            // <span class="labels" style="display:none;">["label1","label2"]</span> 
            // <span class="parent" style="display:none;">null</span> 
            // <span class="children" style="display:none;">[]</span> 
            // <span class="due" style="display:none;">{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","datetime":null,"timezone":null}</span> 
            // <span class="metadata" style="display:none;">{"filePath":"/path/to/file"}</span>
            // `;
            const formattedTask = `             - [ ] An example task #TaskCard             <span class="priority" style="display:none;">4</span>             <span class="description" style="display:none;">"- A multi line description.- the second line."</span>             <span class="order" style="display:none;">1</span>             <span class="project" style="display:none;">{"id":"project-123", "name":"Project Name"}</span>             <span class="section-id" style="display:none;">"section-456"</span>             <span class="labels" style="display:none;">["label1","label2"]</span>             <span class="parent" style="display:none;">null</span>             <span class="children" style="display:none;">[]</span>             <span class="due" style="display:none;">{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","datetime":null,"timezone":null}</span>             <span class="metadata" style="display:none;">{"filePath":"/path/to/file"}</span>`;

            expect(taskValidator.isValidFormattedTaskMarkdown(formattedTask)).toBe(true);
        });

        it('should invalidate incorrectly formatted task markdown', () => {
            const incorrectFormattedTask = `- [ ] Missing TaskCard tag <span class="priority" style="display:none;">4</span>`;

            expect(taskValidator.isValidFormattedTaskMarkdown(incorrectFormattedTask)).toBe(false);
        });

        // More edge cases
        it('should invalidate task markdown without any attributes', () => {
            const taskWithoutAttributes = `  - [ ] An example task #TaskCard`;
            
            expect(taskValidator.isValidFormattedTaskMarkdown(taskWithoutAttributes)).toBe(false);
        });

        it('should invalidate task markdown with no content but has attributes', () => {
            const taskWithAttributesOnly = `- [ ]<span class="priority" style="display:none;">4</span>`;
            
            expect(taskValidator.isValidFormattedTaskMarkdown(taskWithAttributesOnly)).toBe(false);
        });

        it('should validate a task markdown with incorrect tags by just ignoring them', () => {
            const taskWithIncorrectTags = `- [ ] An example task #TaskCard <span class="priority" style="display:none;">4</span> <span class="incorrectAttribute">something</span>`;

            expect(taskValidator.isValidFormattedTaskMarkdown(taskWithIncorrectTags)).toBe(true);
        });
    });

    describe('isValidUnformattedTaskMarkdown', () => {

        it('should validate correctly unformatted task markdown', () => {
            const unformattedTask = `- [ ] An example task #label1 #label2 #TaskCard 
            %%*priority:4*%% 
            %%*description:"- A multi line description.\n- the second line."*%% 
            %%*order:1*%% %%*project:{"id":"project-123", "name":"Project Name"}*%% 
            %%*section-id:"section-456"*%% %%*parent:null*%% %%*children:[]*%% 
            %%*due:"Aug 15, 2024"*%% 
            %%*metadata:{"filePath":"/path/to/file"}*%%`
            ;

            const onelineUnformattedTask = unformattedTask.replace(/\n/g, '');
            
            expect(taskValidator.isValidUnformattedTaskMarkdown(onelineUnformattedTask)).toBe(true);
        });

        it('should invalidate incorrectly unformatted task markdown', () => {
            const incorrectUnformattedTask = `- [ ] An example task #label1 #label2`;
            
            expect(taskValidator.isValidUnformattedTaskMarkdown(incorrectUnformattedTask)).toBe(false);
        });

        // More edge cases
        it('should validate unformatted task markdown with no attributes', () => {
            const taskWithoutAttributes = `- [ ] An example task #label1 #label2 #TaskCard`;
            
            expect(taskValidator.isValidUnformattedTaskMarkdown(taskWithoutAttributes)).toBe(true);
        });

        it('should validate unformatted task markdown with incorrect tags by just ignoring them', () => {
            const taskWithIncorrectTags = `- [ ] An example task #label1 #label2 #TaskCard %%*priority:4*%% %%*incorrectAttribute:something*%%`;
            
            expect(taskValidator.isValidUnformattedTaskMarkdown(taskWithIncorrectTags)).toBe(true);
        });
    });
});