import {
  App,
  ButtonComponent,
  FuzzySuggestModal,
  MarkdownView,
  Modal,
  Notice,
  Setting,
  TFile,
  setIcon
} from 'obsidian';
import type { EditorPosition } from 'obsidian';
import type TaskCardPlugin from '..';
import { DefaultSettings } from '../settings';
import { Project } from '../taskModule/project';
import {
  buildTaskFromQuickAdd,
  QuickAddToken,
  removeTokenSpanFromInput
} from '../quickAdd/nlTokenizer';

type TargetMode = 'active' | 'picked';

const TOKEN_CLASS_BY_TYPE: Record<string, string> = {
  due: 'taskcard-quick-add-token-due',
  duration: 'taskcard-quick-add-token-duration',
  repeat: 'taskcard-quick-add-token-repeat',
  priority: 'taskcard-quick-add-token-priority',
  project: 'taskcard-quick-add-token-project',
  label: 'taskcard-quick-add-token-label'
};

const TOKEN_ICON_BY_TYPE: Record<string, string> = {
  due: 'calendar-clock',
  duration: 'hourglass',
  repeat: 'repeat',
  priority: 'flag',
  project: 'folder',
  label: 'tag'
};

class MarkdownFileSuggestModal extends FuzzySuggestModal<TFile> {
  private onChoose: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder('Choose a markdown note');
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tokenLabel(token: QuickAddToken): string {
  switch (token.type) {
    case 'due':
      return token.display;
    case 'duration':
      return token.display;
    case 'repeat':
      return token.display;
    case 'priority':
      return token.display;
    case 'project':
      return (token.canonical as Project).name;
    case 'label':
      return token.display;
  }
}

function renderHighlightedInput(value: string, tokens: QuickAddToken[]): string {
  if (tokens.length === 0) {
    return `${escapeHtml(value)}<br />`;
  }

  let html = '';
  let cursor = 0;
  for (const token of tokens) {
    html += escapeHtml(value.slice(cursor, token.start));
    html += `<span class="taskcard-quick-add-highlight ${TOKEN_CLASS_BY_TYPE[token.type]}">${escapeHtml(
      value.slice(token.start, token.end)
    )}</span>`;
    cursor = token.end;
  }
  html += escapeHtml(value.slice(cursor));
  return `${html}<br />`;
}

export interface QuickAddInsertionPlan {
  insertFrom: EditorPosition;
  insertText: string;
  cursor: EditorPosition;
}

/**
 * Computes where to splice a quick-added task line into the active editor.
 * The task always lands on its own line, regardless of the cursor's column:
 * a non-empty cursor line gets the task appended after a newline; an empty
 * cursor line (mid-document, or the blank line Obsidian shows at EOF when
 * the file ends with a trailing newline) is filled in place so neither case
 * introduces a stray blank line.
 */
export function computeQuickAddInsertion(
  cursorLine: number,
  currentLineText: string,
  taskLine: string
): QuickAddInsertionPlan {
  if (currentLineText.length === 0) {
    return {
      insertFrom: { line: cursorLine, ch: 0 },
      insertText: taskLine,
      cursor: { line: cursorLine, ch: taskLine.length }
    };
  }

  return {
    insertFrom: { line: cursorLine, ch: currentLineText.length },
    insertText: `\n${taskLine}`,
    cursor: { line: cursorLine + 1, ch: taskLine.length }
  };
}

export class QuickAddTaskModal extends Modal {
  private plugin: TaskCardPlugin;
  private input = '';
  private targetMode: TargetMode = 'active';
  private pickedFile: TFile | null = null;
  private activeFile: TFile | null = null;

  private inputEl: HTMLTextAreaElement;
  private backdropEl: HTMLDivElement;
  private chipsEl: HTMLDivElement;
  private previewEl: HTMLPreElement;
  private targetLabelEl: HTMLSpanElement;
  private addButton: ButtonComponent;

  constructor(app: App, plugin: TaskCardPlugin) {
    super(app);
    this.plugin = plugin;
    this.pickedFile = this.restorePickedFile();
    this.activeFile = this.getActiveMarkdownFile();
    this.targetMode = this.activeFile ? 'active' : this.pickedFile ? 'picked' : 'active';
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('taskcard-quick-add-modal');

    contentEl.createEl('h1', { text: 'Quick add task' });
    contentEl.createEl('p', {
      cls: 'taskcard-quick-add-subtitle',
      text: 'type naturally — attributes are recognized as you type'
    });

    const editorShell = contentEl.createDiv({ cls: 'taskcard-quick-add-editor' });
    this.backdropEl = editorShell.createDiv({
      cls: 'taskcard-quick-add-backdrop'
    });
    this.inputEl = editorShell.createEl('textarea', {
      cls: 'taskcard-quick-add-input'
    }) as HTMLTextAreaElement;
    this.inputEl.rows = 3;
    this.inputEl.placeholder = 'Review PR tomorrow 3pm for 1h !high #code @Work every week';
    this.inputEl.addEventListener('input', () => {
      this.input = this.inputEl.value;
      this.refresh();
    });
    this.inputEl.addEventListener('scroll', () => {
      this.backdropEl.scrollTop = this.inputEl.scrollTop;
      this.backdropEl.scrollLeft = this.inputEl.scrollLeft;
    });

    this.chipsEl = contentEl.createDiv({ cls: 'taskcard-quick-add-chips' });
    this.previewEl = contentEl.createEl('pre', {
      cls: 'taskcard-quick-add-preview'
    }) as HTMLPreElement;

    const footer = contentEl.createDiv({ cls: 'taskcard-quick-add-footer' });
    const targetSection = footer.createDiv({ cls: 'taskcard-quick-add-target' });
    targetSection.createSpan({
      cls: 'taskcard-quick-add-target-label',
      text: 'Target note'
    });
    this.targetLabelEl = targetSection.createSpan({
      cls: 'taskcard-quick-add-target-value'
    }) as HTMLSpanElement;

    new Setting(targetSection).addButton((button) =>
      button.setButtonText('Choose note').onClick(() => {
        new MarkdownFileSuggestModal(this.app, (file) => {
          this.pickedFile = file;
          this.targetMode = 'picked';
          this.plugin.quickAddLastTargetPath = file.path;
          this.refreshTargetLabel();
        }).open();
      })
    );

    new Setting(targetSection).addButton((button) =>
      button.setButtonText('Use active note').onClick(() => {
        this.activeFile = this.getActiveMarkdownFile();
        this.targetMode = 'active';
        this.refreshTargetLabel();
      })
    );

    new Setting(footer).addButton((button) => {
      this.addButton = button;
      button.setButtonText('Add task').setCta().onClick(async () => {
        await this.submit();
      });
    });

    this.refresh();
    this.inputEl.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private getProjects(): Project[] {
    const projects = this.plugin.settings?.userMetadata?.projects;
    return Array.isArray(projects) ? projects : Object.values(projects ?? {});
  }

  private getIndicatorTag(): string {
    return (
      this.plugin.settings?.parsingSettings?.indicatorTag ??
      DefaultSettings.parsingSettings.indicatorTag
    );
  }

  private getActiveMarkdownFile(): TFile | null {
    const activeView = this.app.workspace.getActiveViewOfType(
      MarkdownView
    ) as MarkdownView | null;
    const file = activeView?.file ?? this.app.workspace.getActiveFile();
    return file?.extension === 'md' ? file : null;
  }

  private restorePickedFile(): TFile | null {
    const remembered = this.plugin.quickAddLastTargetPath;
    if (!remembered) return null;
    const file = this.app.vault.getAbstractFileByPath(remembered);
    return file instanceof TFile ? file : null;
  }

  private refresh(): void {
    const parsed = buildTaskFromQuickAdd(
      this.input,
      this.getProjects(),
      this.getIndicatorTag()
    );
    // Preview only — never mints a durable v2 id. The written line gets its
    // id from taskToLine's default (mintId: true) at actual submit time.
    const previewLine = parsed.residualContent
      ? this.plugin.taskFormatter.taskToLine(parsed.task, { mintId: false })
      : '';

    this.backdropEl.innerHTML = renderHighlightedInput(this.input, parsed.tokens);
    this.renderChips(parsed.tokens);
    this.previewEl.setText(previewLine);
    this.refreshTargetLabel();

    const hasTarget = this.resolveTargetFile() !== null;
    this.addButton?.setDisabled(!parsed.residualContent || !hasTarget);
  }

  private renderChips(tokens: QuickAddToken[]): void {
    this.chipsEl.empty();
    for (const token of tokens) {
      const chip = this.chipsEl.createDiv({
        cls: `taskcard-quick-add-chip ${TOKEN_CLASS_BY_TYPE[token.type]}`
      });
      const icon = chip.createSpan({ cls: 'taskcard-quick-add-chip-icon' });
      setIcon(icon, TOKEN_ICON_BY_TYPE[token.type]);
      chip.createSpan({
        cls: 'taskcard-quick-add-chip-label',
        text: tokenLabel(token)
      });
      const removeButton = chip.createEl('button', {
        cls: 'taskcard-quick-add-chip-remove',
        text: '×'
      });
      removeButton.type = 'button';
      removeButton.addEventListener('click', () => {
        this.input = removeTokenSpanFromInput(this.input, token);
        this.inputEl.value = this.input;
        this.refresh();
        this.inputEl.focus();
      });
    }
  }

  private resolveTargetFile(): TFile | null {
    if (this.targetMode === 'active') {
      this.activeFile = this.getActiveMarkdownFile();
      return this.activeFile;
    }
    return this.pickedFile;
  }

  private refreshTargetLabel(): void {
    const target = this.resolveTargetFile();
    const prefix = this.targetMode === 'active' ? 'Active note' : 'Selected note';
    this.targetLabelEl.setText(target ? `${prefix}: ${target.path}` : 'No markdown target selected');
  }

  private async submit(): Promise<void> {
    const target = this.resolveTargetFile();
    if (!target) {
      new Notice('[TaskCard] Choose a markdown note first.');
      return;
    }

    const parsed = buildTaskFromQuickAdd(
      this.input,
      this.getProjects(),
      this.getIndicatorTag()
    );
    if (!parsed.residualContent) {
      new Notice('[TaskCard] Task content cannot be empty.');
      return;
    }

    // Mints the task's durable v2 id (mintId defaults to true) — this is
    // the one point in the modal's lifecycle where an id is actually handed
    // out, matching the format spec (id minted on write, not on preview).
    const line = this.plugin.taskFormatter.taskToLine(parsed.task);
    if (this.targetMode === 'active' && (await this.tryInsertIntoActiveEditor(target, line))) {
      new Notice('[TaskCard] Task added.');
      this.close();
      return;
    }

    await this.app.vault.process(target, (content) => {
      const trimmed = content.replace(/\s+$/, '');
      return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
    });
    this.plugin.quickAddLastTargetPath = target.path;
    new Notice('[TaskCard] Task added.');
    this.close();
  }

  private async tryInsertIntoActiveEditor(
    target: TFile,
    line: string
  ): Promise<boolean> {
    const activeView = this.app.workspace.getActiveViewOfType(
      MarkdownView
    ) as MarkdownView | null;
    const editor = activeView?.editor;
    if (!activeView || !editor || activeView.file?.path !== target.path) {
      return false;
    }

    const cursor = editor.getCursor();
    const plan = computeQuickAddInsertion(cursor.line, editor.getLine(cursor.line), line);
    editor.replaceRange(plan.insertText, plan.insertFrom);
    editor.setCursor(plan.cursor);
    return true;
  }
}
