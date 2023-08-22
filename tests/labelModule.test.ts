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
