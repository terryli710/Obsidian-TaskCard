import { LabelModule } from '../src/taskModule/labels';

describe('LabelModule', () => {
  let labelModule: LabelModule;

  beforeEach(() => {
    labelModule = new LabelModule();
  });

  test('addLabel should add a valid label to the list', () => {
    labelModule.addLabel('validLabel');
    expect(labelModule.getLabels()).toEqual(['#validLabel']);
  });

  test('addLabel should add another valid label with #', () => {
    labelModule.addLabel('#validLabel');
    expect(labelModule.getLabels()).toEqual(['#validLabel']);
  });

  test('addLabel should not add an invalid label in strict mode', () => {
    labelModule.addLabel('invalid Label', true);
    expect(labelModule.getLabels()).toEqual([]);
  });

  test('addLabel should format and add an invalid label in non-strict mode', () => {
    labelModule.addLabel('#invalidLabel', false);
    expect(labelModule.getLabels()).toEqual(['#invalidLabel']);
  });

  test('addLabels should add multiple labels', () => {
    labelModule.addLabels(['labelOne', 'labelTwo']);
    expect(labelModule.getLabels()).toEqual(['#labelOne', '#labelTwo']);
  });

  test('setLabels should set the list of labels', () => {
    labelModule.setLabels(['newLabelOne', 'newLabelTwo']);
    expect(labelModule.getLabels()).toEqual(['#newLabelOne', '#newLabelTwo']);
  });

  test('editLabel should update an existing label', () => {
    labelModule.addLabel('oldLabel');
    labelModule.editLabel('newLabel', 'oldLabel');
    expect(labelModule.getLabels()).toEqual(['#newLabel']);
  });

  test('editLabel should throw an error if the old label is not found', () => {
    expect(() =>
      labelModule.editLabel('newLabel', 'nonexistentLabel')
    ).toThrowError('Label not found');
  });

  test('editLabel should log an error if the new label is invalid in strict mode', () => {
    labelModule.addLabel('oldLabel');
    labelModule.editLabel('#invalid Label', 'oldLabel', true);
    // We can't test logger.error output in Jest, so we just check that the label wasn't changed
    expect(labelModule.getLabels()).toEqual(['#oldLabel']);
  });

  test('deleteLabel should remove a label from the list', () => {
    labelModule.addLabels(['labelOne', 'labelTwo']);
    labelModule.deleteLabel('labelOne');
    expect(labelModule.getLabels()).toEqual(['#labelTwo']);
  });

  test('deleteLabel should throw an error if the label is not found', () => {
    expect(() => labelModule.deleteLabel('nonexistentLabel')).toThrowError(
      'Label not found'
    );
  });

  test('validateLabel should format an invalid label', () => {
    const formattedLabel = labelModule.validateLabel('# invalid Label');
    expect(formattedLabel).toEqual('invalidLabel');
  });
});

describe('native labels across the UI label lifecycle', () => {
  test.each(['中文', '🐱', '♥', '→', 'école', 'cafe\u0301', '2026计划', 'work/项目🐱'])('preserves native tag %j when adding, setting and editing', label => {
    const labels = new LabelModule();
    expect(labels.isValidLabel(label)).toBe(true);
    labels.setLabels([`#${label}`], false);
    expect(labels.getLabels()).toEqual([`#${label}`]);
    labels.editLabel(`${label}/详细`, `#${label}`);
    expect(labels.getLabels()).toEqual([`#${label}/详细`]);
  });

  test.each(['', '123', 'invalid label', 'bad!label', 'bad.label', 'bad#label', '中文,项目'])('rejects malformed native token %j in strict mode', label => {
    const labels = new LabelModule();
    expect(labels.isValidLabel(label)).toBe(false);
    labels.addLabel(label);
    expect(labels.getLabels()).toEqual([]);
  });

  test.each([
    ['# invalid Label', 'invalidLabel'],
    ['invalid@ Label!', 'invalidLabel'],
    ['中文 标签🐱', '中文标签🐱'],
    ['工作! 计划', '工作计划'],
    ['Cafe\u0301 Plan', 'cafe\u0301Plan']
  ])('non-strict cleanup preserves native characters in %j', (source, expected) => {
    const labels = new LabelModule();
    expect(labels.validateLabel(source)).toBe(expected);
    labels.addLabel(source, false);
    expect(labels.getLabels()).toEqual([`#${expected}`]);
  });

  test('deduplicates case-insensitively while retaining the first source spelling', () => {
    const labels = new LabelModule();
    labels.addLabels(['#Work/项目🐱', 'work/项目🐱', '#WORK/项目🐱', '#École', '#école']);
    expect(labels.getLabels()).toEqual(['#Work/项目🐱', '#École']);
  });

  test('edits and deletes a native label using a differently cased lookup', () => {
    const labels = new LabelModule();
    labels.setLabels(['#Work/项目🐱']);
    labels.editLabel('#研究/🐱', '#WORK/项目🐱');
    expect(labels.getLabels()).toEqual(['#研究/🐱']);
    labels.editLabel('École', '#研究/🐱');
    labels.deleteLabel('#ÉCOLE');
    expect(labels.getLabels()).toEqual([]);
  });

  test('editing into an existing label collapses the duplicate and preserves the existing spelling', () => {
    const labels = new LabelModule();
    labels.setLabels(['#Work/项目🐱', '#Home']);
    labels.editLabel('#WORK/项目🐱', '#home');
    expect(labels.getLabels()).toEqual(['#Work/项目🐱']);
  });

  test('non-strict edits preserve Unicode and deduplicate their sanitized result', () => {
    const labels = new LabelModule();
    labels.setLabels(['#工作计划', '#Home']);
    labels.editLabel('工作! 计划', '#HOME', false);
    expect(labels.getLabels()).toEqual(['#工作计划']);
  });
});
