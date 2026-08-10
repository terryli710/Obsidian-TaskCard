import moment from 'moment';

/**
 * Minimal mock of the `obsidian` package for Jest.
 *
 * Mapped in jest.config.js via moduleNameMapper, so any `import ... from 'obsidian'`
 * in src/ resolves here during tests. Only implements the surface the plugin
 * actually touches; extend as new tests require.
 *
 * Intentionally NOT polyfilled: Obsidian's Array.prototype extensions
 * (`contains`, `remove`, ...). Plugin code should use standard Array methods so
 * logic modules stay testable outside the Obsidian runtime.
 */

/* ------------------------------------------------------------------ Events */

export class Events {
  private _handlers: Record<string, Array<(...args: any[]) => any>> = {};

  on(name: string, callback: (...args: any[]) => any, ctx?: any): any {
    if (!this._handlers[name]) this._handlers[name] = [];
    this._handlers[name].push(callback);
    return { name, callback };
  }

  off(name: string, callback: (...args: any[]) => any): void {
    this._handlers[name] = (this._handlers[name] || []).filter(
      (cb) => cb !== callback
    );
  }

  offref(ref: any): void {
    if (ref && ref.name) this.off(ref.name, ref.callback);
  }

  trigger(name: string, ...args: any[]): void {
    (this._handlers[name] || []).slice().forEach((cb) => cb(...args));
  }
}

/* ------------------------------------------------------------------- Files */

export class TAbstractFile {
  path: string = '';
  name: string = '';
  parent: TFolder | null = null;
  vault: Vault | null = null;
}

export class TFile extends TAbstractFile {
  basename: string = '';
  extension: string = '';
  stat = { ctime: 0, mtime: 0, size: 0 };

  constructor(path: string = '') {
    super();
    this.setPath(path);
  }

  setPath(path: string): void {
    this.path = path;
    this.name = path.split('/').pop() ?? '';
    const dot = this.name.lastIndexOf('.');
    this.basename = dot === -1 ? this.name : this.name.slice(0, dot);
    this.extension = dot === -1 ? '' : this.name.slice(dot + 1);
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

/* ------------------------------------------------------------------- Vault */

/**
 * In-memory vault. Test helpers: `__setFile(path, content)` seeds a file and
 * returns its TFile; `__getContent(path)` reads it back synchronously.
 */
export class Vault extends Events {
  private _files = new Map<string, { file: TFile; content: string }>();

  __setFile(path: string, content: string): TFile {
    const existing = this._files.get(path);
    if (existing) {
      existing.content = content;
      return existing.file;
    }
    const file = new TFile(path);
    file.vault = this;
    this._files.set(path, { file, content });
    return file;
  }

  __getContent(path: string): string | undefined {
    return this._files.get(path)?.content;
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this._files.get(path)?.file ?? null;
  }

  getMarkdownFiles(): TFile[] {
    return Array.from(this._files.values())
      .map((e) => e.file)
      .filter((f) => f.extension === 'md');
  }

  getFiles(): TFile[] {
    return Array.from(this._files.values()).map((e) => e.file);
  }

  async read(file: TFile): Promise<string> {
    const entry = this._files.get(file.path);
    if (!entry) throw new Error(`File not found: ${file.path}`);
    return entry.content;
  }

  async cachedRead(file: TFile): Promise<string> {
    return this.read(file);
  }

  async modify(file: TFile, data: string): Promise<void> {
    const entry = this._files.get(file.path);
    if (!entry) throw new Error(`File not found: ${file.path}`);
    entry.content = data;
    this.trigger('modify', file);
  }

  async create(path: string, data: string): Promise<TFile> {
    const file = this.__setFile(path, data);
    this.trigger('create', file);
    return file;
  }

  async delete(file: TFile): Promise<void> {
    this._files.delete(file.path);
    this.trigger('delete', file);
  }

  async process(
    file: TFile,
    fn: (data: string) => string
  ): Promise<string> {
    const content = await this.read(file);
    const next = fn(content);
    await this.modify(file, next);
    return next;
  }

  on(name: string, callback: (...args: any[]) => any, ctx?: any): any {
    return super.on(name, callback, ctx);
  }
}

/* ------------------------------------------- Workspace / views / metadata */

export class WorkspaceLeaf {
  view: any = null;
  openFile = jest.fn();
}

export class MarkdownView {
  file: TFile | null = null;
  editor: any = null;
  leaf: WorkspaceLeaf = new WorkspaceLeaf();
}

export class Workspace extends Events {
  activeLeaf: WorkspaceLeaf | null = null;

  getActiveViewOfType<T>(_type: any): T | null {
    return (this.activeLeaf?.view as T) ?? null;
  }

  getActiveFile(): TFile | null {
    return null;
  }

  openLinkText = jest.fn();
  getLeaf = jest.fn(() => new WorkspaceLeaf());
  updateOptions = jest.fn();
  onLayoutReady(cb: () => void): void {
    cb();
  }
}

export class MetadataCache extends Events {
  getFileCache(_file: TFile): any {
    return null;
  }

  getFirstLinkpathDest(_linkpath: string, _sourcePath: string): TFile | null {
    return null;
  }
}

export function getAllTags(cache: any): string[] | null {
  const tags = (cache?.tags ?? [])
    .map((entry: any) => entry?.tag)
    .filter((tag: unknown): tag is string => typeof tag === 'string');
  return tags.length > 0 ? tags : null;
}

export class App {
  vault = new Vault();
  workspace = new Workspace();
  metadataCache = new MetadataCache();
}

/* ------------------------------------------------------------------ Plugin */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
  authorUrl?: string;
  isDesktopOnly?: boolean;
}

export class Component {
  _loaded = false;
  private _children: Component[] = [];
  private _registered: Array<() => any> = [];

  load(): void {
    this._loaded = true;
    this.onload();
    this._children.forEach((c) => c.load());
  }

  unload(): void {
    this._loaded = false;
    this.onunload();
    this._registered.forEach((cb) => cb());
    this._registered = [];
    this._children.forEach((c) => c.unload());
  }

  onload(): void {}
  onunload(): void {}

  addChild<T extends Component>(child: T): T {
    this._children.push(child);
    if (this._loaded) child.load();
    return child;
  }

  removeChild<T extends Component>(child: T): T {
    this._children = this._children.filter((c) => c !== child);
    child.unload();
    return child;
  }

  register(cb: () => any): void {
    this._registered.push(cb);
  }

  registerEvent(_eventRef: any): void {}
  registerDomEvent = jest.fn();
  registerInterval(id: number): number {
    return id;
  }
}

export class Plugin extends Component {
  app: App;
  manifest: PluginManifest;

  // recorded registrations, for assertions
  __commands: any[] = [];
  __settingTabs: any[] = [];
  __postProcessors: any[] = [];
  __codeBlockProcessors: Record<string, any> = {};
  __editorSuggests: any[] = [];
  __editorExtensions: any[] = [];
  __data: any = null;

  constructor(app?: App, manifest?: Partial<PluginManifest>) {
    super();
    this.app = app ?? new App();
    this.manifest = {
      id: 'task-card',
      name: 'TaskCard',
      version: '0.0.0-test',
      minAppVersion: '1.0.0',
      description: 'test',
      author: 'test',
      ...(manifest ?? {})
    };
  }

  addCommand(command: any): any {
    this.__commands.push(command);
    return command;
  }

  addSettingTab(tab: any): void {
    this.__settingTabs.push(tab);
  }

  addRibbonIcon = jest.fn(() => ({ addClass: jest.fn() }));
  addStatusBarItem = jest.fn(() => createElOrStub('div'));

  registerMarkdownPostProcessor(processor: any): any {
    this.__postProcessors.push(processor);
    return processor;
  }

  registerMarkdownCodeBlockProcessor(language: string, handler: any): any {
    this.__codeBlockProcessors[language] = handler;
    return handler;
  }

  registerEditorSuggest(suggest: any): void {
    this.__editorSuggests.push(suggest);
  }

  registerEditorExtension(extension: any): void {
    this.__editorExtensions.push(extension);
  }

  async loadData(): Promise<any> {
    return this.__data;
  }

  async saveData(data: any): Promise<void> {
    this.__data = data;
  }
}

/* ---------------------------------------------------------------- Settings */

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: any;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = createElOrStub('div');
  }

  display(): void {}
  hide(): void {}
}

class BaseComponent {
  disabled = false;
  setDisabled(disabled: boolean): this {
    this.disabled = disabled;
    return this;
  }
}

export class TextComponent extends BaseComponent {
  inputEl: any = createElOrStub('input');
  private _value = '';
  private _onChange: ((value: string) => any) | null = null;

  setValue(value: string): this {
    this._value = value;
    if (this.inputEl) this.inputEl.value = value;
    return this;
  }

  getValue(): string {
    return this._value;
  }

  setPlaceholder(_p: string): this {
    return this;
  }

  onChange(cb: (value: string) => any): this {
    this._onChange = cb;
    return this;
  }

  __triggerChange(value: string): void {
    this.setValue(value);
    this._onChange?.(value);
  }
}

export class ToggleComponent extends BaseComponent {
  private _value = false;
  private _onChange: ((value: boolean) => any) | null = null;

  setValue(value: boolean): this {
    this._value = value;
    return this;
  }

  getValue(): boolean {
    return this._value;
  }

  onChange(cb: (value: boolean) => any): this {
    this._onChange = cb;
    return this;
  }

  __triggerChange(value: boolean): any {
    this.setValue(value);
    return this._onChange?.(value);
  }
}

export class ButtonComponent extends BaseComponent {
  buttonEl: any = createElOrStub('button');
  private _onClick: (() => any) | null = null;

  setButtonText(_t: string): this {
    return this;
  }

  setCta(): this {
    return this;
  }

  setWarning(): this {
    return this;
  }

  setIcon(_icon: string): this {
    return this;
  }

  setTooltip(_t: string): this {
    return this;
  }

  onClick(cb: () => any): this {
    this._onClick = cb;
    return this;
  }

  __click(): void {
    this._onClick?.();
  }
}

export class ColorComponent extends BaseComponent {
  private _value = '#000000';
  private _onChange: ((value: string) => any) | null = null;

  setValue(value: string): this {
    this._value = value;
    return this;
  }

  getValue(): string {
    return this._value;
  }

  onChange(cb: (value: string) => any): this {
    this._onChange = cb;
    return this;
  }

  __triggerChange(value: string): void {
    this.setValue(value);
    this._onChange?.(value);
  }
}

export class DropdownComponent extends BaseComponent {
  private _value = '';
  private _options: Record<string, string> = {};
  private _onChange: ((value: string) => any) | null = null;

  addOption(value: string, display: string): this {
    this._options[value] = display;
    return this;
  }

  addOptions(options: Record<string, string>): this {
    Object.assign(this._options, options);
    return this;
  }

  setValue(value: string): this {
    this._value = value;
    return this;
  }

  getValue(): string {
    return this._value;
  }

  onChange(cb: (value: string) => any): this {
    this._onChange = cb;
    return this;
  }

  __triggerChange(value: string): void {
    this.setValue(value);
    this._onChange?.(value);
  }
}

/**
 * Chainable Setting mock; records created components on `__components`.
 */
export class Setting {
  settingEl: any;
  __components: any[] = [];
  __name = '';
  __desc = '';

  constructor(containerEl?: any) {
    this.settingEl = createElOrStub('div');
    if (containerEl && typeof containerEl.appendChild === 'function') {
      try {
        containerEl.appendChild(this.settingEl);
      } catch {
        /* stub container */
      }
    }
  }

  setName(name: string): this {
    this.__name = name;
    return this;
  }

  setDesc(desc: any): this {
    this.__desc = typeof desc === 'string' ? desc : String(desc?.textContent ?? '');
    return this;
  }

  setHeading(): this {
    return this;
  }

  setClass(_cls: string): this {
    return this;
  }

  setTooltip(_t: string): this {
    return this;
  }

  private _add<T>(component: T, cb?: (c: T) => any): this {
    this.__components.push(component);
    cb?.(component);
    return this;
  }

  addText(cb?: (c: TextComponent) => any): this {
    return this._add(new TextComponent(), cb);
  }

  addTextArea(cb?: (c: TextComponent) => any): this {
    return this._add(new TextComponent(), cb);
  }

  addToggle(cb?: (c: ToggleComponent) => any): this {
    return this._add(new ToggleComponent(), cb);
  }

  addButton(cb?: (c: ButtonComponent) => any): this {
    return this._add(new ButtonComponent(), cb);
  }

  addExtraButton(cb?: (c: ButtonComponent) => any): this {
    return this._add(new ButtonComponent(), cb);
  }

  addDropdown(cb?: (c: DropdownComponent) => any): this {
    return this._add(new DropdownComponent(), cb);
  }

  addColorPicker(cb?: (c: ColorComponent) => any): this {
    return this._add(new ColorComponent(), cb);
  }

  addSlider(cb?: (c: any) => any): this {
    const slider = {
      setLimits: () => slider,
      setValue: () => slider,
      setDynamicTooltip: () => slider,
      onChange: () => slider
    };
    return this._add(slider, cb);
  }
}

/* ----------------------------------------------------------------- UI bits */

export class Notice {
  static __notices: any[] = [];
  noticeEl: any;

  constructor(message?: any, _timeout?: number) {
    Notice.__notices.push(message);
    this.noticeEl = createElOrStub('div');
  }

  setMessage(message: any): this {
    Notice.__notices.push(message);
    return this;
  }

  hide(): void {}
}

export class Modal {
  app: App;
  contentEl: any;
  titleEl: any;

  constructor(app: App) {
    this.app = app;
    this.contentEl = createElOrStub('div');
    this.titleEl = createElOrStub('div');
  }

  open(): void {
    this.onOpen();
  }

  close(): void {
    this.onClose();
  }

  onOpen(): void {}
  onClose(): void {}
}

export class SuggestModal<T> extends Modal {
  limit = 100;
  inputEl: any;

  constructor(app: App) {
    super(app);
    this.inputEl = createElOrStub('input');
  }

  getSuggestions(_query: string): T[] {
    return [];
  }

  renderSuggestion(_value: T, _el: HTMLElement): void {}

  onChooseSuggestion(_item: T, _evt?: MouseEvent | KeyboardEvent): void {}

  setPlaceholder(_value: string): this {
    return this;
  }
}

export class FuzzySuggestModal<T> extends SuggestModal<T> {
  getItems(): T[] {
    return [];
  }

  getItemText(_item: T): string {
    return '';
  }

  onChooseItem(_item: T, _evt?: MouseEvent | KeyboardEvent): void {}
}

export class Menu {
  __items: any[] = [];

  addItem(cb: (item: any) => any): this {
    const item = {
      __title: '',
      __icon: '',
      __onClick: null as null | ((evt: any) => any),
      setTitle(t: string) {
        this.__title = t;
        return this;
      },
      setIcon(i: string) {
        this.__icon = i;
        return this;
      },
      onClick(fn: (evt: any) => any) {
        this.__onClick = fn;
        return this;
      }
    };
    cb(item);
    this.__items.push(item);
    return this;
  }

  addSeparator(): this {
    return this;
  }

  showAtMouseEvent(_evt: any): this {
    return this;
  }

  showAtPosition(_pos: any): this {
    return this;
  }
}

export class MarkdownRenderChild extends Component {
  containerEl: any;

  constructor(containerEl: any) {
    super();
    this.containerEl = containerEl;
  }
}

export class EditorSuggest {
  app: App;
  context: any = null;
  limit = 100;

  constructor(app: App) {
    this.app = app;
  }

  close(): void {}
  setInstructions(_i: any): void {}
  onTrigger(_cursor: any, _editor: any, _file: any): any {
    return null;
  }
  getSuggestions(_ctx: any): any[] {
    return [];
  }
  renderSuggestion(_value: any, _el: any): void {}
  selectSuggestion(_value: any, _evt: any): void {}
}

/* ------------------------------------------------------------------- Misc */

export const Platform = {
  isDesktop: true,
  isDesktopApp: true,
  isMobile: false,
  isMobileApp: false,
  isMacOS: true,
  isWin: false,
  isLinux: false,
  isIosApp: false,
  isAndroidApp: false
};

export const requestUrl = jest.fn(async (_req: any) => ({
  status: 200,
  headers: {},
  text: '',
  json: {},
  arrayBuffer: new ArrayBuffer(0)
}));

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\//, '');
}

export function setIcon(_el: any, _icon: string): void {}
export { moment };

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  _timeout?: number,
  _resetTimer?: boolean
): T {
  // synchronous pass-through keeps tests deterministic
  return fn;
}

/**
 * Tiny subset of Obsidian's htmlToMarkdown: handles the ul/ol/li structures the
 * description parser feeds it. Deterministic on purpose.
 */
export function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<\/?(ul|ol)[^>]*>/g, '');
  md = md.replace(/<li[^>]*>/g, '- ');
  md = md.replace(/<\/li>/g, '\n');
  md = md.replace(/<br\s*\/?>/g, '\n');
  md = md.replace(/<[^>]+>/g, '');
  return md
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/* ------------------------------------------ type-only names (runtime stubs) */

export class Editor {}
export interface EditorPosition {
  line: number;
  ch: number;
}
export interface MarkdownPostProcessorContext {
  docId: string;
  sourcePath: string;
  frontmatter: any | null;
  addChild(child: MarkdownRenderChild): void;
  getSectionInfo(el: any): MarkdownSectionInformation | null;
}
export interface MarkdownSectionInformation {
  text: string;
  lineStart: number;
  lineEnd: number;
}
export interface OpenViewState {}

/* -------------------------------------------------- DOM prototype helpers */

function createElOrStub(tag: string): any {
  if (typeof document !== 'undefined') return document.createElement(tag);
  // node environment: minimal stand-in so constructors don't crash
  return {
    tagName: tag.toUpperCase(),
    value: '',
    style: {},
    dataset: {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false
    },
    children: [],
    appendChild(child: any) {
      this.children.push(child);
      return child;
    },
    setAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    empty() {
      this.children = [];
    },
    setText() {},
    createEl(t: string) {
      const el = createElOrStub(t);
      this.children.push(el);
      return el;
    },
    createDiv() {
      return this.createEl('div');
    },
    createSpan() {
      return this.createEl('span');
    }
  };
}

/**
 * Install Obsidian's HTMLElement helpers onto the jsdom prototypes so DOM-touching
 * plugin code (settings tab, modals, svelte components) runs under jsdom tests.
 */
function installDomHelpers(): void {
  if (typeof HTMLElement === 'undefined') return;
  const proto = HTMLElement.prototype as any;
  if (proto.createEl) return;

  function applyInfo(el: HTMLElement, info: any): void {
    if (typeof info === 'string') {
      el.className = info;
      return;
    }
    if (!info) return;
    if (info.cls) {
      el.className = Array.isArray(info.cls) ? info.cls.join(' ') : info.cls;
    }
    if (info.text != null) el.textContent = String(info.text);
    if (info.attr) {
      for (const [k, v] of Object.entries(info.attr)) {
        if (v != null) el.setAttribute(k, String(v));
      }
    }
    if (info.type) (el as any).type = info.type;
    if (info.value != null) (el as any).value = info.value;
    if (info.placeholder) (el as any).placeholder = info.placeholder;
    if (info.href) (el as any).href = info.href;
    if (info.title) el.title = info.title;
  }

  proto.createEl = function (tag: string, info?: any, callback?: (el: any) => void) {
    const el = document.createElement(tag);
    applyInfo(el, info);
    this.appendChild(el);
    callback?.(el);
    return el;
  };
  proto.createDiv = function (info?: any, callback?: (el: any) => void) {
    return this.createEl('div', info, callback);
  };
  proto.createSpan = function (info?: any, callback?: (el: any) => void) {
    return this.createEl('span', info, callback);
  };
  proto.empty = function () {
    while (this.firstChild) this.removeChild(this.firstChild);
  };
  proto.setText = function (text: string) {
    this.textContent = text;
  };
  proto.appendText = function (text: string) {
    this.appendChild(document.createTextNode(text));
  };
  proto.addClass = function (...classes: string[]) {
    this.classList.add(...classes);
  };
  proto.removeClass = function (...classes: string[]) {
    this.classList.remove(...classes);
  };
  proto.toggleClass = function (cls: string, value: boolean) {
    this.classList.toggle(cls, value);
  };
  proto.hasClass = function (cls: string) {
    return this.classList.contains(cls);
  };
  proto.setAttr = function (name: string, value: any) {
    this.setAttribute(name, String(value));
  };
  proto.getAttr = function (name: string) {
    return this.getAttribute(name);
  };
  proto.detach = function () {
    this.remove();
  };
  proto.hide = function () {
    this.style.display = 'none';
  };
  proto.show = function () {
    this.style.display = '';
  };
}

installDomHelpers();
