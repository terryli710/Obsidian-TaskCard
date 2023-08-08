

import { escapeRegExp, extractTags } from '../src/utils/regexUtils';

describe('textUtils', () => {
    describe('escapeRegExp', () => {
        it('should escape special characters in a string', () => {
            const input = '.*+?^${}()|[\\]';
            const expected = '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\\\\\]';
            expect(escapeRegExp(input)).toEqual(expected);
        });

        it('should return the same string if no special characters are present', () => {
            const input = 'normalString';
            expect(escapeRegExp(input)).toEqual(input);
        });
    });

    describe('extractTags', () => {
        it('should extract valid tags from a text and return remaining content without tags', () => {
            const text = "some content with   tags #tag1 #tag2 #tag3";
            const expectedTags = ['#tag1', '#tag2', '#tag3'];
            const expectedContent = "some content with   tags";
            const [tags, content] = extractTags(text);
            expect(tags).toEqual(expectedTags);
            expect(content).toEqual(expectedContent);
        });

        it('should return an empty array if no valid tags are present and the original text', () => {
            const text = "This is a sample text with no valid tags.";
            const expectedTags = [];
            const expectedContent = "This is a sample text with no valid tags.";
            const [tags, content] = extractTags(text);
            expect(tags).toEqual(expectedTags);
            expect(content).toEqual(expectedContent);
        });

        it('should handle multiple consecutive spaces created by tags', () => {
            const text = "This   is a    sample #tag1   text #tag2 with  spaces.";
            const expectedTags = ['#tag1', '#tag2'];
            const expectedContent = "This   is a    sample   text with  spaces.";
            const [tags, content] = extractTags(text);
            expect(tags).toEqual(expectedTags);
            expect(content).toEqual(expectedContent);
        });

        it('should handle texts that have only tags', () => {
            const text = "#only #tags #here";
            const expectedTags = ['#only', '#tags', '#here'];
            const expectedContent = "";
            const [tags, content] = extractTags(text);
            expect(tags).toEqual(expectedTags);
            expect(content).toEqual(expectedContent);
        });

        it('should handle empty texts', () => {
            const text = "";
            const expectedTags = [];
            const expectedContent = "";
            const [tags, content] = extractTags(text);
            expect(tags).toEqual(expectedTags);
            expect(content).toEqual(expectedContent);
        });
    });
});