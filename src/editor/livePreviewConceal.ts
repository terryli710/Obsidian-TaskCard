import { Prec, RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { setIcon } from 'obsidian';
import { moment } from '../utils/obsidianMoment';
import { get } from 'svelte/store';
import { SettingStore } from '../settings';
import {
  findBlockIdSpan,
  findIndicatorTagSpan,
  findInlineFieldSpans,
  priorityWordToNumber,
  type KnownFieldKey
} from '../taskModule/fieldSyntax';
import { isTaskCardTaskLine } from '../taskModule/taskValidator';

const FIELD_ICONS: Partial<Record<KnownFieldKey, string>> = {
  due: 'calendar-x',
  scheduled: 'calendar-clock',
  repeat: 'repeat',
  duration: 'hourglass',
  project: 'folder',
  completion: 'calendar-check'
};

const CONCEALED_FIELD_KEYS = new Set<KnownFieldKey>([
  'due',
  'scheduled',
  'repeat',
  'duration',
  'project',
  'priority',
  'completion'
]);

type PriorityClass = 'taskcard-lp-priority-1' | 'taskcard-lp-priority-2' | 'taskcard-lp-priority-3';

interface FieldRenderSpec {
  from: number;
  to: number;
  key: KnownFieldKey;
  displayText: string;
  icon: string | null;
  tone: 'accent' | 'muted';
}

interface TaskCardConcealPlan {
  fields: FieldRenderSpec[];
  hiddenFields: Array<{ from: number; to: number }>;
  indicatorTag: { from: number; to: number } | null;
  blockId: { from: number; to: number } | null;
  priorityClass: PriorityClass | null;
}

function isLivePreview(view: EditorView): boolean {
  return !!view.dom.closest('.markdown-source-view.is-live-preview');
}

function formatFieldDisplayValue(key: KnownFieldKey, value: string): string {
  if (key !== 'due' && key !== 'scheduled' && key !== 'completion') return value;
  const trimmed = value.trim();
  const parsed = moment(trimmed, ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DDTHH:mm'], true);
  if (!parsed.isValid()) return trimmed;
  return parsed.format(parsed.hour() === 0 && parsed.minute() === 0 && !/[T ]\d{2}:\d{2}$/.test(trimmed) ? 'MMM D' : 'MMM D, H:mm');
}

export function getTaskCardConcealPlan(
  lineText: string,
  indicatorTag: string
): TaskCardConcealPlan | null {
  if (!isTaskCardTaskLine(lineText, indicatorTag)) return null;

  const candidateFields = findInlineFieldSpans(lineText).filter(
    (field) => field.canonicalKey && CONCEALED_FIELD_KEYS.has(field.canonicalKey)
  );
  const fields: FieldRenderSpec[] = candidateFields
    .filter((field) => field.canonicalKey !== 'priority')
    .map((field) => ({
      from: field.from,
      to: field.to,
      key: field.canonicalKey,
      displayText: formatFieldDisplayValue(
        field.canonicalKey,
        field.value
      ),
      icon: FIELD_ICONS[field.canonicalKey] ?? null,
      tone:
        field.canonicalKey === 'due' || field.canonicalKey === 'scheduled'
          ? 'accent'
          : 'muted'
    }));

  const priorityField = candidateFields.find(
    (field) => field.canonicalKey === 'priority'
  );
  const priorityValue = priorityField
    ? priorityWordToNumber(priorityField.value)
    : null;
  // Matches the Reading-mode checkbox tint in src/ui/TaskCard.svelte exactly
  // (priority 1/2/3 tinted, 4 unstyled) so a task's color never changes
  // between Live Preview and Reading mode.
  let priorityClass: PriorityClass | null = null;
  if (priorityValue === 1) {
    priorityClass = 'taskcard-lp-priority-1';
  } else if (priorityValue === 2) {
    priorityClass = 'taskcard-lp-priority-2';
  } else if (priorityValue === 3) {
    priorityClass = 'taskcard-lp-priority-3';
  }

  return {
    fields,
    hiddenFields: priorityField
      ? [{ from: priorityField.from, to: priorityField.to }]
      : [],
    indicatorTag: findIndicatorTagSpan(lineText, indicatorTag),
    blockId: findBlockIdSpan(lineText),
    priorityClass
  };
}

function rangeTouchesSelection(
  from: number,
  to: number,
  updateRanges: readonly { from: number; to: number }[]
): boolean {
  return updateRanges.some((range) => {
    if (range.from === range.to) {
      return range.from >= from && range.from <= to;
    }
    return range.from < to && range.to > from;
  });
}

class HiddenWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = createSpan();
    span.className = 'taskcard-lp-hidden';
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  eq(): boolean {
    return true;
  }

  ignoreEvent(event: Event): boolean {
    return event instanceof MouseEvent;
  }
}

class FieldWidget extends WidgetType {
  constructor(
    private readonly icon: string | null,
    private readonly displayText: string,
    private readonly tone: 'accent' | 'muted'
  ) {
    super();
  }

  eq(other: FieldWidget): boolean {
    return (
      this.icon === other.icon &&
      this.displayText === other.displayText &&
      this.tone === other.tone
    );
  }

  toDOM(): HTMLElement {
    const span = createSpan();
    span.className = `taskcard-lp-field taskcard-lp-field-${this.tone}`;
    span.setAttribute('aria-hidden', 'true');

    if (this.icon) {
      const iconEl = createSpan();
      iconEl.className = 'taskcard-lp-field-icon';
      setIcon(iconEl, this.icon);
      span.appendChild(iconEl);
    }

    const textEl = createSpan();
    textEl.className = 'taskcard-lp-field-text';
    textEl.textContent = this.displayText;
    span.appendChild(textEl);
    return span;
  }

  ignoreEvent(event: Event): boolean {
    return event instanceof MouseEvent;
  }
}

interface DecorationSpan {
  from: number;
  to: number;
  decoration: Decoration;
}

/**
 * Pure per-line span computation: given one line's text, its offset into the
 * document, the indicator tag, and the current selection, returns every
 * decoration span the line contributes — unsorted, in plan order. Kept
 * side-effect free (no EditorView) so it can be exercised directly in tests.
 */
function collectLineDecorationSpans(
  lineText: string,
  lineFrom: number,
  indicatorTag: string,
  selectionRanges: readonly { from: number; to: number }[]
): DecorationSpan[] {
  const plan = getTaskCardConcealPlan(lineText, indicatorTag);
  if (!plan) return [];

  const spans: DecorationSpan[] = [];

  if (plan.priorityClass) {
    spans.push({
      from: lineFrom,
      to: lineFrom,
      decoration: Decoration.line({ attributes: { class: plan.priorityClass } })
    });
  }

  for (const field of plan.fields) {
    const from = lineFrom + field.from;
    const to = lineFrom + field.to;
    if (rangeTouchesSelection(from, to, selectionRanges)) continue;
    spans.push({
      from,
      to,
      decoration: Decoration.replace({
        widget: new FieldWidget(field.icon, field.displayText, field.tone)
      })
    });
  }

  for (const span of [...plan.hiddenFields, plan.indicatorTag, plan.blockId]) {
    if (!span) continue;
    const from = lineFrom + span.from;
    const to = lineFrom + span.to;
    if (rangeTouchesSelection(from, to, selectionRanges)) continue;
    spans.push({ from, to, decoration: Decoration.replace({ widget: new HiddenWidget() }) });
  }

  return spans;
}

/**
 * Builds the full decoration set for a list of lines. Spans are collected
 * per line and then sorted by `from` (stable) before being handed to
 * RangeSetBuilder — CM6 requires strictly ascending `from`/`startSide`
 * ordering across the *whole* set, and within a single line the indicator
 * tag / priority field spans can sit earlier than fields already collected,
 * so per-loop insertion order is not safe to add directly.
 *
 * Exported as a pure function (no EditorView) so it can be exercised in
 * tests via the real RangeSetBuilder without constructing a full editor.
 */
export function buildDecorationsForLines(
  lines: readonly { text: string; from: number }[],
  indicatorTag: string,
  selectionRanges: readonly { from: number; to: number }[] = []
): DecorationSet {
  const spans: DecorationSpan[] = [];
  for (const line of lines) {
    spans.push(...collectLineDecorationSpans(line.text, line.from, indicatorTag, selectionRanges));
  }
  spans.sort((a, b) => a.from - b.from);

  const builder = new RangeSetBuilder<Decoration>();
  for (const span of spans) {
    builder.add(span.from, span.to, span.decoration);
  }
  return builder.finish();
}

function buildDecorations(view: EditorView): DecorationSet {
  const settings = get(SettingStore);
  if (!settings.displaySettings.styleMetadataInLivePreview) {
    return Decoration.none;
  }
  if (!isLivePreview(view)) {
    return Decoration.none;
  }

  const indicatorTag = settings.parsingSettings.indicatorTag;
  const seenLines = new Set<number>();
  const selectionRanges = view.state.selection.ranges.map((range) => ({
    from: range.from,
    to: range.to
  }));

  const lines: { text: string; from: number }[] = [];
  for (const visible of view.visibleRanges) {
    let line = view.state.doc.lineAt(visible.from);
    while (line.from <= visible.to) {
      if (!seenLines.has(line.number)) {
        seenLines.add(line.number);
        lines.push({ text: line.text, from: line.from });
      }

      if (line.to >= visible.to) break;
      line = view.state.doc.line(line.number + 1);
    }
  }

  return buildDecorationsForLines(lines, indicatorTag, selectionRanges);
}

/**
 * Wrapped in Prec.high: Dataview (>=0.5.68) also replace-decorates
 * `[key:: value]` spans in Live Preview, and CM6 resolves overlapping replace
 * decorations by extension precedence, falling back to registration order.
 * Registration order inverts whenever this plugin is reloaded after Dataview
 * (hot-reload does this on every rebuild), which handed the fields to
 * Dataview's boxed pills instead of the conceal chips. Explicit precedence
 * makes the conceal win regardless of load order.
 */
export function createTaskCardLivePreviewConcealExtension() {
  return Prec.high(ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (value) => value.decorations
    }
  ));
}
