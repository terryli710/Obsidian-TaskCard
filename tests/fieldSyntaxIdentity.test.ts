import { hasTaskIdentity } from '../src/taskModule/fieldSyntax';

const legacy = '<span class="task-card-data" style="display:none">{"id":"legacy-id"}</span>';

describe('persisted task identity', () => {
  it.each([
    ['- [ ] Task ^tc-native01', 'tc-native01', true],
    ['> 2) [ ] Task ^native-block', 'native-block', true],
    ['- [ ] Task ^tc-native010', 'tc-native01', false],
    ['Paragraph ^tc-native01', 'tc-native01', false],
    ['- [ ] Task `literal ^tc-native01`', 'tc-native01', false],
    ['- [ ] Task \\^tc-native01', 'tc-native01', false],
    ['- [ ] Task ' + legacy, 'legacy-id', true],
    ['- [ ] Task <span style=" display: none; ">{ "id" : "legacy-id" }</span>', 'legacy-id', true],
    ['- [ ] Task <span>{"id":"legacy-id"}</span>', 'legacy-id', false],
    ['- [ ] Task <span style="display:none">{bad JSON}</span>', 'legacy-id', false],
    ['- [ ] Task `{"id":"legacy-id"}`', 'legacy-id', false],
    ['- [ ] Task `' + legacy + '`', 'legacy-id', false],
    ['- [ ] Task [' + legacy + '](https://example.org)', 'legacy-id', false],
    ['- [ ] Task %% ' + legacy + ' %%', 'legacy-id', false],
    ['- [ ] Task <!-- ' + legacy + ' -->', 'legacy-id', false],
  ])('matches only a real exact identity in %s', (line, id, expected) => {
    expect(hasTaskIdentity(line as string, id as string)).toBe(expected);
  });
});
