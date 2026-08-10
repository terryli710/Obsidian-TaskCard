import { writable } from 'svelte/store';
import { buildTaskFromQuickAdd, removeTokenSpanFromInput, tokenizeQuickAddInput } from '../src/quickAdd/nlTokenizer';
import { Project, ProjectModule } from '../src/taskModule/project';
import { TaskFormatter } from '../src/taskModule/taskFormatter';
import { TaskParser } from '../src/taskModule/taskParser';

describe('nl quick add tokenizer', () => {
  const input =
    'Review PR tomorrow 3pm for 1h !high #code @Work every week';
  const projects: Project[] = [
    { id: 'work-1', name: 'Work', color: '#ff0000' },
    { id: 'home-1', name: 'Home', color: '#00ff00' }
  ];

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-09T10:00:00'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('extracts spans and canonical values for the decided example line', () => {
    const result = tokenizeQuickAddInput(input, projects, 'TaskCard');
    expect(result.residualContent).toBe('Review PR');

    const due = result.tokens.find((token) => token.type === 'due');
    expect(due).toBeDefined();
    expect(due!.start).toBe(input.indexOf('tomorrow 3pm'));
    expect(due!.end).toBe(due!.start + 'tomorrow 3pm'.length);
    expect(due!.canonical).toMatchObject({
      date: '2026-07-10',
      time: '15:00'
    });
    // Normalized to the canonical grammar (mirrors TaskParser.parseSchedule),
    // not the raw NL span, so re-parses never drift off this value.
    expect((due!.canonical as { string?: string }).string).toBe('2026-07-10T15:00');

    const duration = result.tokens.find((token) => token.type === 'duration');
    expect(duration).toBeDefined();
    expect(duration!.display).toBe('for 1h');
    expect(duration!.canonical).toEqual({ hours: 1, minutes: 0 });

    const priority = result.tokens.find((token) => token.type === 'priority');
    expect(priority?.canonical).toBe(2);

    const label = result.tokens.find((token) => token.type === 'label');
    expect(label?.canonical).toBe('#code');

    const project = result.tokens.find((token) => token.type === 'project');
    expect((project?.canonical as Project).name).toBe('Work');

    const repeat = result.tokens.find((token) => token.type === 'repeat');
    expect(repeat?.canonical).toBe('every week');
  });

  it('composes date and time into a single due token', () => {
    const result = tokenizeQuickAddInput('Ship update tomorrow 3pm', projects, 'TaskCard');
    const dueTokens = result.tokens.filter((token) => token.type === 'due');
    expect(dueTokens).toHaveLength(1);
    expect(dueTokens[0].display).toBe('tomorrow 3pm');
    expect(dueTokens[0].canonical).toMatchObject({
      date: '2026-07-10',
      time: '15:00'
    });
  });

  it('keeps an explicitly named midnight at minute resolution', () => {
    const result = tokenizeQuickAddInput(
      'Ship update tomorrow midnight',
      projects,
      'TaskCard'
    );
    const due = result.tokens.find((token) => token.type === 'due');
    expect(due?.display).toBe('tomorrow midnight');
    expect(due?.canonical).toMatchObject({
      date: '2026-07-10',
      time: '00:00',
      string: '2026-07-10T00:00'
    });
  });

  it('removes a token span and collapses doubled whitespace', () => {
    const result = tokenizeQuickAddInput(input, projects, 'TaskCard');
    const due = result.tokens.find((token) => token.type === 'due')!;
    expect(removeTokenSpanFromInput(input, due)).toBe(
      'Review PR for 1h !high #code @Work every week'
    );
  });

  it('ignores unmatched @word tokens and keeps them in the content', () => {
    const result = tokenizeQuickAddInput('Follow up @Unknown tomorrow', projects, 'TaskCard');
    expect(result.tokens.some((token) => token.type === 'project')).toBe(false);
    expect(result.residualContent).toBe('Follow up @Unknown');
  });

  it('extracts hashtag labels as labels, not content', () => {
    const result = tokenizeQuickAddInput('Write tests #backend #qa', projects, 'TaskCard');
    expect(
      result.tokens
        .filter((token) => token.type === 'label')
        .map((token) => token.canonical)
    ).toEqual(['#backend', '#qa']);
    expect(result.residualContent).toBe('Write tests');
  });

  it('excludes the default indicator tag from labels and content instead of duplicating it', () => {
    const result = tokenizeQuickAddInput('Write tests #TaskCard #backend', projects, 'TaskCard');
    expect(
      result.tokens.filter((token) => token.type === 'label').map((token) => token.canonical)
    ).toEqual(['#backend']);
    expect(result.residualContent).toBe('Write tests');
  });

  it('excludes a custom indicator tag from labels while leaving other tags alone', () => {
    const result = tokenizeQuickAddInput('Write tests #MyTasks #backend', projects, 'MyTasks');
    expect(
      result.tokens.filter((token) => token.type === 'label').map((token) => token.canonical)
    ).toEqual(['#backend']);
    expect(result.residualContent).toBe('Write tests');

    // With the default tag configured, a custom-tag-shaped hashtag is just
    // an ordinary label — proves the comparison is parameterized, not hardcoded.
    const withDefaultTag = tokenizeQuickAddInput(
      'Write tests #MyTasks #backend',
      projects,
      'TaskCard'
    );
    expect(
      withDefaultTag.tokens
        .filter((token) => token.type === 'label')
        .map((token) => token.canonical)
    ).toEqual(['#MyTasks', '#backend']);
  });
});

describe('nl quick add round trip', () => {
  let taskFormatter: TaskFormatter;
  let taskParser: TaskParser;
  let projectModule: ProjectModule;
  const settingsStore = writable({
    parsingSettings: {
      indicatorTag: 'TaskCard',
      markdownStartingNotation: '%%*',
      markdownEndingNotation: '*%%',
      markdownSuffix: ' .',
      writeCompletionDate: true
    },
    userMetadata: {
      projects: [{ id: 'work-1', name: 'Work', color: '#ff0000' }]
    },
    displaySettings: {
      defaultMode: 'single-line'
    }
  });

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-09T10:00:00'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    projectModule = new ProjectModule();
    projectModule.updateProjects([{ id: 'work-1', name: 'Work', color: '#ff0000' }]);
    taskFormatter = new TaskFormatter(settingsStore as any);
    taskParser = new TaskParser(settingsStore as any, projectModule);
  });

  it('round-trips tokenizer output through taskToLine and parseAnyTaskMarkdown', () => {
    const { task } = buildTaskFromQuickAdd(
      'Review PR tomorrow 3pm for 1h !high #code @Work every week',
      [{ id: 'work-1', name: 'Work', color: '#ff0000' }],
      'TaskCard'
    );

    const line = taskFormatter.taskToLine(task);
    expect(line).toContain('- [ ] Review PR #code #TaskCard');
    expect(line).toContain('[priority:: high]');
    expect(line).toContain('[due:: 2026-07-10T15:00]');
    expect(line).toContain('[duration:: 1h]');
    expect(line).toContain('[repeat:: every week]');
    expect(line).toContain('[project:: Work]');

    const parsed = taskParser.parseAnyTaskMarkdown(line);
    expect(parsed.content).toBe('Review PR');
    expect(parsed.labels).toEqual(['#code']);
    expect(parsed.priority).toBe(2);
    expect(parsed.due).toMatchObject({
      date: '2026-07-10',
      time: '15:00'
    });
    expect(parsed.duration).toEqual({ hours: 1, minutes: 0 });
    expect(parsed.recurrence).toBe('every week');
    expect(parsed.project?.name).toBe('Work');
  });
});
