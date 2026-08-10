import { RangeSetBuilder } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import {
  findBlockIdSpan,
  findIndicatorTagSpan,
  findInlineFieldSpans
} from '../src/taskModule/fieldSyntax';
import {
  buildDecorationsForLines,
  getTaskCardConcealPlan
} from '../src/editor/livePreviewConceal';

describe('Live Preview conceal helpers', () => {
  it('finds inline field spans on a canonical v2 line', () => {
    const line =
      '- [ ] Draft Q3 report #report #TaskCard [priority:: high] [due:: 2026-07-10] [scheduled:: 2026-07-11 09:00] [project:: Work] ^tc-4f2a1b';
    const fields = findInlineFieldSpans(line);

    expect(fields.map((field) => field.canonicalKey)).toEqual([
      'priority',
      'due',
      'scheduled',
      'project'
    ]);
    expect(fields.map((field) => line.slice(field.from, field.to))).toEqual([
      '[priority:: high]',
      '[due:: 2026-07-10]',
      '[scheduled:: 2026-07-11 09:00]',
      '[project:: Work]'
    ]);
  });

  it('handles v2 lines without a block id', () => {
    const line = '- [ ] Standup #TaskCard [duration:: 30m] [project:: Team]';

    expect(findBlockIdSpan(line)).toBeNull();
    expect(findIndicatorTagSpan(line, 'TaskCard')).toEqual({
      from: line.indexOf('#TaskCard'),
      to: line.indexOf('#TaskCard') + '#TaskCard'.length
    });
  });

  it('returns no conceal plan for non-TaskCard lines', () => {
    const line = '- [ ] Plain task [due:: 2026-07-10]';
    expect(getTaskCardConcealPlan(line, 'TaskCard')).toBeNull();
  });

  it('builds the expected conceal plan for quiet-inline rendering', () => {
    const line =
      '- [ ] Draft Q3 report #report #TaskCard [priority:: high] [due:: 2026-07-10] [scheduled:: 2026-07-11 09:00] [duration:: 30m] [project:: Work] ^tc-4f2a1b';
    const plan = getTaskCardConcealPlan(line, 'TaskCard');

    expect(plan).not.toBeNull();
    expect(plan!.priorityClass).toBe('taskcard-lp-priority-2');
    expect(plan!.fields.map((field) => ({
      key: field.key,
      displayText: field.displayText,
      icon: field.icon
    }))).toEqual([
      { key: 'due', displayText: 'Jul 10', icon: 'calendar-x' },
      { key: 'scheduled', displayText: 'Jul 11, 9:00', icon: 'calendar-clock' },
      { key: 'duration', displayText: '30m', icon: 'hourglass' },
      { key: 'project', displayText: 'Work', icon: 'folder' }
    ]);
    expect(plan!.hiddenFields).toHaveLength(1);
    expect(line.slice(plan!.hiddenFields[0].from, plan!.hiddenFields[0].to)).toBe(
      '[priority:: high]'
    );
    expect(plan!.blockId).toEqual({
      id: 'tc-4f2a1b',
      from: line.lastIndexOf('^tc-4f2a1b'),
      to: line.length
    });
  });

  it('renders the completion field as a muted chip with the short date format', () => {
    const line =
      '- [x] Request time off work #TaskCard [project:: Japan Trip] [completion:: 2026-07-05] ^tc-xfbe8i';
    const plan = getTaskCardConcealPlan(line, 'TaskCard');

    expect(plan).not.toBeNull();
    expect(plan!.fields.map((field) => ({
      key: field.key,
      displayText: field.displayText,
      icon: field.icon,
      tone: field.tone
    }))).toEqual([
      { key: 'project', displayText: 'Japan Trip', icon: 'folder', tone: 'muted' },
      { key: 'completion', displayText: 'Jul 5', icon: 'calendar-check', tone: 'muted' }
    ]);
  });

  it.each([
    ['highest', 'taskcard-lp-priority-1'],
    ['high', 'taskcard-lp-priority-2'],
    ['medium', 'taskcard-lp-priority-3'],
    ['low', null]
  ])(
    'maps priority %s to the card-matching tint class (Reading-mode parity)',
    (priorityWord, expectedClass) => {
      const line = `- [ ] Task #TaskCard [priority:: ${priorityWord}]`;
      const plan = getTaskCardConcealPlan(line, 'TaskCard');
      expect(plan!.priorityClass).toBe(expectedClass);
    }
  );
});

describe('buildDecorationsForLines (real RangeSetBuilder path)', () => {
  it('documents the ordering bug: naive per-loop insertion order throws', () => {
    // Reproduces the pre-fix buildDecorations shape — fields added first
    // (ascending), then hiddenFields/indicatorTag/blockId in a second loop.
    // The indicator tag sits earlier in the line than the fields already
    // added, so RangeSetBuilder.add() throws on out-of-order `from`.
    const line =
      '- [ ] content #labels #TaskCard [priority:: high] [due:: 2026-07-10] [repeat:: every week] [project:: Work] ^tc-4f2a1b';
    const plan = getTaskCardConcealPlan(line, 'TaskCard')!;
    const builder = new RangeSetBuilder<Decoration>();
    const mark = Decoration.mark({ class: 'x' });

    for (const field of plan.fields) {
      builder.add(field.from, field.to, mark);
    }

    expect(() => {
      for (const span of [...plan.hiddenFields, plan.indicatorTag, plan.blockId]) {
        if (!span) continue;
        builder.add(span.from, span.to, mark);
      }
    }).toThrow(/sorted by `from`/);
  });

  it('builds decorations for the spec canonical line without throwing, with the expected range count', () => {
    const line =
      '- [ ] content #labels #TaskCard [priority:: high] [due:: 2026-07-10] [repeat:: every week] [project:: Work] ^tc-4f2a1b';

    let result: ReturnType<typeof buildDecorationsForLines>;
    expect(() => {
      result = buildDecorationsForLines([{ text: line, from: 0 }], 'TaskCard', []);
    }).not.toThrow();

    // 1 priority line decoration + 3 field widgets (due, repeat, project)
    // + 3 hidden spans (priority field, indicator tag, block id) = 7
    expect(result!.size).toBe(7);
  });

  it('builds decorations for a line without priority or a block id, without throwing', () => {
    const line = '- [ ] Standup #TaskCard [duration:: 30m] [project:: Team]';

    let result: ReturnType<typeof buildDecorationsForLines>;
    expect(() => {
      result = buildDecorationsForLines([{ text: line, from: 0 }], 'TaskCard', []);
    }).not.toThrow();

    // 2 field widgets (duration, project) + 1 hidden span (indicator tag) = 3
    expect(result!.size).toBe(3);
  });

  it('skips a span that intersects the current selection, leaving it as raw text', () => {
    const line = '- [ ] Standup #TaskCard [duration:: 30m] [project:: Team]';
    const durationFrom = line.indexOf('[duration');

    const result = buildDecorationsForLines(
      [{ text: line, from: 0 }],
      'TaskCard',
      [{ from: durationFrom + 1, to: durationFrom + 1 }]
    );

    // duration field is revealed (cursor inside it) -> only project field +
    // indicator tag remain concealed
    expect(result.size).toBe(2);
  });
});
