import { writable } from 'svelte/store';
import { TaskParser } from '../src/taskModule/taskParser';
import { TaskFormatter } from '../src/taskModule/taskFormatter';
import { TaskValidator } from '../src/taskModule/taskValidator';
import { ProjectModule } from '../src/taskModule/project';
import { extractTags, hasIndicatorTag } from '../src/utils/regexUtils';
import { findIndicatorTagSpan, stripTaskSyntaxForDisplay } from '../src/taskModule/fieldSyntax';

const settings: any = writable({ parsingSettings: { indicatorTag: 'TaskCard', markdownSuffix: " .", markdownStartingNotation: '%%*', markdownEndingNotation: '*%%' } });
const parser = new TaskParser(settings, new ProjectModule());
const formatter = new TaskFormatter(settings);
const validator = new TaskValidator(settings);

test.each(['- [ ] ', '* [-] ', '+ [X] ', '1. [/] ', '12) [?] ', '> - [ ] ', '> > 2. [x] ', '  > + [ ] ', '\t- [ ] '])('round trips native task prefix %s', prefix => {
  const source = `${prefix}Review #taskcard/work #2026plan #🔥 [priority:: high] ^tc-native`;
  expect(validator.isTaskCardTaskMarkdown(source)).toBe(true);
  const task = parser.parseAnyTaskMarkdown(source);
  expect(task.content).toBe('Review');
  expect(task.labels).toEqual(['#taskcard/work', '#2026plan', '#🔥']);
  expect(task.completed).toBe(/[xX]/.test(prefix));
  expect(task.metadata.sourceMarkdown).toBe(source);
  task.priority = 1;
  const written = formatter.taskToMarkdown(task);
  expect(written.startsWith(prefix)).toBe(true);
  expect(written).not.toContain(' #TaskCard ');
  task.completed = !task.completed;
  const toggled = formatter.taskToMarkdown(task);
  expect(toggled.startsWith(prefix.replace(/\[[^\]]\]/, `[${task.completed ? 'x' : ' '}]`))).toBe(true);
});

test.each(['Read `%%* priority: 1 *%%` carefully', 'Read [plan](https://example.com/%%*priority:1*%%) carefully'])('preserves literal legacy markers in %s', content => {
  const task = parser.parseAnyTaskMarkdown(`- [ ] ${content} #TaskCard [due:: 2026-10-25] ^tc-literal`);
  expect(task.content).toBe(content);
  expect(task.priority).toBe(4);
  expect(formatter.taskToMarkdown(task)).toContain(content);
});

test('keeps real legacy metadata while ignoring code examples', () => {
  const task = parser.parseAnyTaskMarkdown('- [ ] Keep `%%* due: tomorrow *%%` carefully #TaskCard %%* priority: 1 *%%');
  expect(task.content).toBe('Keep `%%* due: tomorrow *%%` carefully');
  expect(task.priority).toBe(1);
  expect(validator.hasLegacyNotation('- [ ] `%%* due: tomorrow *%%` #TaskCard')).toBe(false);
  expect(validator.hasLegacyNotation('- [ ] `%%* due: tomorrow *%%` #TaskCard %%* priority: 1 *%%')).toBe(true);
});

test('keeps tag boundaries next to hidden HTML without extracting protection placeholders', () => {
  const source = '- [ ] old #TaskCard<span style="display:none">{"id":"legacy-1"}</span> .';
  expect(validator.isTaskCardTaskMarkdown(source)).toBe(true);
  expect(validator.hasLegacyNotation(source)).toBe(true);
  const task = parser.parseAnyTaskMarkdown(source);
  expect(task.labels).toEqual([]);
  expect(task.content).toBe('old');
});

test.each(['#taskcard', '#TASKCARD/work', '#TaskCard/🔥', '#TaskCard/2026plan'])('accepts native indicator %s', tag => expect(hasIndicatorTag(tag, 'TaskCard')).toBe(true));
test.each(['#TaskCard🔥', '#TaskCardOther', '#TaskCard_other', 'word#TaskCard', '##TaskCard'])('rejects unrelated token %s', tag => expect(hasIndicatorTag(tag, 'TaskCard')).toBe(false));
test('extracts full native tags without extracting numeric references', () => {
  const [labels, body] = extractTags('Read #123 #2026plan #🔥 #TaskCard🔥 #任务/🔥.');
  expect(labels).toEqual(['#2026plan', '#🔥', '#TaskCard🔥', '#任务/🔥']);
  expect(body).toContain('#123');
});
test('exact indicator conceal respects full native tag boundaries and insensitive matching', () => {
  expect(findIndicatorTagSpan('- [ ] X #taskcard', 'TaskCard')).toEqual({from: 8, to: 17});
  expect(findIndicatorTagSpan('- [ ] X #TaskCard🔥', 'TaskCard')).toBeNull();
  expect(stripTaskSyntaxForDisplay('- [ ] X #TaskCard🔥 #taskcard ^tc-test', 'TaskCard')).toBe('- [ ] X #TaskCard🔥');
});
test.each(['## Following heading', '* [ ] Next #TaskCard', '1. [ ] Next #TaskCard', 'Unindented paragraph'])('does not consume neighboring block %s', next => {
  expect(parser.determineDescriptionLineNumber(['- [ ] Review #TaskCard', '    details', next])).toBe(1);
});

test('preserves quoted description geometry without consuming a following callout block', () => {
  const source = '> - [?] Review #TaskCard ^tc-quoted\n>     details\n>     - [ ] child';
  const task = parser.parseAnyTaskMarkdown(source);
  expect(task.description).toBe('details\n- [ ] child');
  expect(formatter.taskToMarkdown(task)).toBe(source);
  expect(parser.determineDescriptionLineNumber([...source.split('\n'), '> ## Next heading', '> - [ ] Sibling #TaskCard'])).toBe(2);
});

test('never consumes an under-indented sibling of a long ordered marker', () => {
  expect(parser.determineDescriptionLineNumber(['123. [ ] Parent #TaskCard ^tc-parent', '  - [ ] Sibling #TaskCard ^tc-sibling'])).toBe(0);
});
test('keeps edited description nested beneath a long ordered marker', () => {
  const task = parser.parseAnyTaskMarkdown('123. [ ] Parent #TaskCard ^tc-parent\n     - [ ] child');
  task.description = '- [ ] renamed';
  expect(formatter.taskToMarkdown(task)).toBe('123. [ ] Parent #TaskCard ^tc-parent\n     - [ ] renamed');
});
test('uses tab stops when determining description ownership', () => {
  expect(parser.determineDescriptionLineNumber(['-\t[ ] Parent #TaskCard ^tc-parent', '    - [ ] child'])).toBe(1);
  const task = parser.parseAnyTaskMarkdown('-\t[ ] Parent #TaskCard ^tc-parent\n    - [ ] child');
  task.description = '- [ ] renamed';
  expect(formatter.taskToMarkdown(task)).toBe('-\t[ ] Parent #TaskCard ^tc-parent\n    - [ ] renamed');
});
