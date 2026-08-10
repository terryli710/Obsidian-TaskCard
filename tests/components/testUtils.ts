/**
 * Local Svelte component test harness.
 *
 * WORKAROUNDS for two setup gaps (jest.config.js must not be edited from
 * component tests, so both are handled locally here):
 *
 * 1. `@testing-library/svelte@4` is published as pure ESM ("type": "module"),
 *    but transformIgnorePatterns only exempts `node_modules/svelte`, so
 *    importing it fails with "Cannot use import statement outside a module".
 *    -> `render`/`fireEvent`/`cleanup` below re-implement the tiny slice of
 *    its API these tests need, on top of @testing-library/dom (CJS) and
 *    Svelte 4's public class API.
 *
 * 2. `svelte-jester@3` refuses to compile Svelte 4 components when Jest runs
 *    in CJS mode ("Jest is being called in CJS mode. You must use ESM mode in
 *    Svelte 4+"), and this repo's Jest runs in CJS mode. So `.svelte` files
 *    cannot be `import`ed in tests at all. -> `loadSvelte()` below compiles a
 *    component on the fly (svelte.config.js preprocessing -> svelte/compiler
 *    -> esbuild ESM->CJS) and evaluates it with a require shim that delegates
 *    bare/TS imports back to Jest (so the `obsidian` moduleNameMapper mock and
 *    the single shared `svelte/internal` runtime instance still apply).
 *
 * Proper fix would be running Jest in ESM mode (--experimental-vm-modules,
 * ESM presets) or pinning svelte-jester/testing-library versions compatible
 * with CJS mode; both require jest.config.js / package.json changes.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  fireEvent as domFireEvent,
  getQueriesForElement,
  screen,
  waitFor,
  within
} from '@testing-library/dom';
import { tick } from 'svelte';

/**
 * WORKAROUND (env gap): jest-environment-jsdom strips Node's setImmediate,
 * but winston's Console transport (src/utils/log.ts logger) calls it at log
 * time, so any component path that logs would throw
 * "ReferenceError: setImmediate is not defined". Polyfill it here.
 */
if (typeof (globalThis as any).setImmediate === 'undefined') {
  (globalThis as any).setImmediate = (
    fn: (...args: any[]) => void,
    ...args: any[]
  ) => setTimeout(fn, 0, ...args);
  (globalThis as any).clearImmediate = (id: any) => clearTimeout(id);
}

/* ------------------------------------------------- on-the-fly .svelte loader */

// Deliberately require()d so ts-jest keeps them out of the type surface.
// (typescript, not esbuild, does the ESM->CJS step: esbuild refuses to run
// under jsdom because Buffer instanceof Uint8Array fails across realms.)
const { preprocess, compile } = require('svelte/compiler');
const ts = require('typescript');
const svelteConfig = require('../../svelte.config.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const componentCache = new Map<string, any>();
const transpiledModuleCache = new Map<string, any>();

function resolveSvelteImport(spec: string, importer: string): string {
  if (spec.startsWith('/')) return spec;
  if (spec.startsWith('.')) {
    return path.resolve(path.dirname(importer), spec);
  }
  return require.resolve(spec, { paths: [path.dirname(importer)] });
}

function isLucideSveltePath(absPath: string): boolean {
  return absPath.includes(
    `${path.sep}lucide-svelte${path.sep}dist${path.sep}svelte${path.sep}`
  );
}

function createMockSvelteComponent(name: string): any {
  function instance($$self: any, $$props: any, $$invalidate: any) {
    let { ariaLabel = name } = $$props;

    $$self.$$set = ($$nextProps: any) => {
      if ('ariaLabel' in $$nextProps) {
        $$invalidate(0, (ariaLabel = $$nextProps.ariaLabel));
      }
    };

    return [ariaLabel];
  }

  function create_fragment(ctx: any) {
    let span: HTMLElement;

    return {
      c() {
        span = document.createElement('span');
        span.setAttribute('data-mock-icon', ctx[0]);
      },
      m(target: HTMLElement, anchor: HTMLElement | null) {
        target.insertBefore(span, anchor);
      },
      p(ctx: any, [dirty]: [number]) {
        if (dirty & 1) {
          span.setAttribute('data-mock-icon', ctx[0]);
        }
      },
      d(detaching: boolean) {
        if (detaching) span.remove();
      }
    };
  }

  return class MockIcon extends (require('svelte/internal').SvelteComponent) {
    constructor(options: any) {
      super();
      require('svelte/internal').init(
        this,
        options,
        instance,
        create_fragment,
        require('svelte/internal').safe_not_equal,
        { ariaLabel: 0 }
      );
    }
  };
}

/** Absolute path to a file under src/, e.g. srcPath('ui/Labels.svelte'). */
export function srcPath(relative: string): string {
  return path.join(REPO_ROOT, 'src', relative);
}

/**
 * Compile and evaluate a .svelte file (and, recursively, the .svelte files it
 * imports), returning the component class. Non-svelte imports are delegated
 * to Jest's own require, so `obsidian` still resolves to tests/__mocks__ and
 * all components share one svelte/internal runtime.
 */
export async function loadSvelte(absPath: string): Promise<any> {
  const resolved = path.resolve(absPath);
  const cached = componentCache.get(resolved);
  if (cached) return cached.default;

  if (isLucideSveltePath(resolved)) {
    const mock = {
      __esModule: true,
      default: createMockSvelteComponent(path.basename(resolved, '.svelte'))
    };
    componentCache.set(resolved, mock);
    return mock.default;
  }

  const source = fs.readFileSync(resolved, 'utf8');
  const processed = await preprocess(source, svelteConfig.preprocess, {
    filename: resolved
  });
  const compiled = compile(processed.code, {
    filename: resolved,
    dev: true,
    accessors: true,
    css: 'injected',
    generate: 'dom'
  });
  const cjs = ts.transpileModule(compiled.js.code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true
    }
  }).outputText;

  // Pre-load nested .svelte imports (compilation is async, require is sync).
  const specifiers: string[] = Array.from(
    cjs.matchAll(/require\("([^"]+)"\)/g),
    (m: RegExpMatchArray) => m[1]
  );
  for (const spec of specifiers) {
    if (spec.endsWith('.svelte')) {
      await loadSvelte(resolveSvelteImport(spec, resolved));
    }
  }

  const moduleObj = { exports: {} as any };
  const shimRequire = (spec: string): any => {
    if (spec.endsWith('.svelte')) {
      const childPath = resolveSvelteImport(spec, resolved);
      const child = componentCache.get(path.resolve(childPath));
      if (!child) throw new Error(`Svelte child not preloaded: ${childPath}`);
      return child;
    }

    if (spec.startsWith('.') || spec.startsWith('/')) {
      const childPath = spec.startsWith('/')
        ? spec
        : path.resolve(path.dirname(resolved), spec);
      if (childPath.endsWith('.svelte')) {
        const child = componentCache.get(path.resolve(childPath));
        if (!child) throw new Error(`Svelte child not preloaded: ${childPath}`);
        return child;
      }
      return requireWithEsmFallback(childPath); // .ts/.js via ts-jest/esbuild-jest
    }
    return requireWithEsmFallback(spec); // bare imports: svelte/internal, obsidian (mocked), moment, ...
  };
  const evaluate = new Function('require', 'module', 'exports', cjs);
  evaluate(shimRequire, moduleObj, moduleObj.exports);

  componentCache.set(resolved, moduleObj.exports);
  return moduleObj.exports.default;
}

function requireWithEsmFallback(spec: string): any {
  try {
    return require(spec);
  } catch (error: any) {
    const message = String(error?.message || error);
    const resolved =
      spec.startsWith('.') || spec.startsWith('/')
        ? spec
        : require.resolve(spec, { paths: [REPO_ROOT] });

    if (
      resolved.endsWith('.js') &&
      resolved.includes(`${path.sep}node_modules${path.sep}`) &&
      (message.includes("Unexpected token 'export'") ||
        message.includes('Cannot use import statement outside a module'))
    ) {
      const cached = transpiledModuleCache.get(resolved);
      if (cached) return cached;

      const source = fs.readFileSync(resolved, 'utf8');
      const cjs = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2019,
          esModuleInterop: true
        }
      }).outputText;

      const moduleObj = { exports: {} as any };
      const localRequire = (childSpec: string): any => {
        if (childSpec.endsWith('.svelte')) {
          const childPath = resolveSvelteImport(childSpec, resolved);
          const child = componentCache.get(path.resolve(childPath));
          if (!child) {
            throw new Error(`Svelte child not preloaded: ${childPath}`);
          }
          return child;
        }
        if (childSpec.startsWith('.') || childSpec.startsWith('/')) {
          const childPath = childSpec.startsWith('/')
            ? childSpec
            : path.resolve(path.dirname(resolved), childSpec);
          return requireWithEsmFallback(childPath);
        }
        return requireWithEsmFallback(childSpec);
      };
      const evaluate = new Function('require', 'module', 'exports', cjs);
      evaluate(localRequire, moduleObj, moduleObj.exports);
      transpiledModuleCache.set(resolved, moduleObj.exports);
      return moduleObj.exports;
    }

    throw error;
  }
}

type SvelteComponentInstance = {
  $set(props: Record<string, unknown>): void;
  $on(event: string, handler: (event: CustomEvent) => void): () => void;
  $destroy(): void;
};

export interface RenderResult {
  container: HTMLElement;
  component: SvelteComponentInstance;
  unmount: () => void;
  /** update props and flush Svelte's microtask queue */
  setProps: (props: Record<string, unknown>) => Promise<void>;
}

const mountedComponents = new Set<SvelteComponentInstance>();
const mountedContainers = new Set<HTMLElement>();

export function render(
  Component: any,
  props: Record<string, unknown> = {}
): RenderResult {
  const container = document.body.appendChild(document.createElement('div'));
  const ComponentConstructor = Component.default ?? Component;
  // accept both render(C, { props: {...} }) and render(C, {...})
  const componentProps =
    props && typeof props === 'object' && 'props' in props
      ? (props as any).props
      : props;
  const component: SvelteComponentInstance = new ComponentConstructor({
    target: container,
    props: componentProps
  });

  mountedComponents.add(component);
  mountedContainers.add(container);

  return {
    container,
    component,
    unmount: () => {
      component.$destroy();
      mountedComponents.delete(component);
    },
    setProps: async (nextProps) => {
      component.$set(nextProps);
      await tick();
    }
  };
}

export function cleanup(): void {
  mountedComponents.forEach((component) => component.$destroy());
  mountedComponents.clear();
  mountedContainers.forEach((container) => container.remove());
  mountedContainers.clear();
}

// Auto-cleanup per test file (module registry is per-file in Jest).
afterEach(cleanup);

type AsyncFireFn = (...args: any[]) => Promise<boolean>;
type AsyncFireEvent = AsyncFireFn & Record<string, AsyncFireFn>;

/**
 * Same shape as @testing-library/svelte's fireEvent: dispatches via
 * @testing-library/dom, then awaits Svelte's `tick()` so the DOM has settled.
 */
export const fireEvent: AsyncFireEvent = (async (...args: [any, any]) => {
  const result = (domFireEvent as any)(...args);
  await tick();
  return result;
}) as AsyncFireEvent;

for (const key of Object.keys(domFireEvent)) {
  (fireEvent as any)[key] = async (...args: unknown[]) => {
    const result = (domFireEvent as any)[key](...args);
    await tick();
    return result;
  };
}

export { screen, waitFor, within, getQueriesForElement, tick };
