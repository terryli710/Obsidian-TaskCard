/**
 * Obsidian augments Node and UIEvent with `instanceOf()`, a cross-window-safe
 * replacement for the `instanceof` operator: a node created in a popout window
 * comes from a different realm, so its constructor is a different object and
 * plain `instanceof HTMLElement` returns false. Plugin code is expected to use
 * it (obsidianmd/prefer-instanceof enforces this), but jsdom has no such
 * method, so tests have to install it themselves.
 *
 * Same-realm semantics are all a test needs, so this delegates to `instanceof`.
 */
export function installInstanceOf(target: Window | typeof globalThis = globalThis): void {
  const protos = [
    (target as Window & typeof globalThis).Node?.prototype,
    (target as Window & typeof globalThis).UIEvent?.prototype
  ];
  for (const proto of protos) {
    if (!proto || 'instanceOf' in proto) continue;
    Object.defineProperty(proto, 'instanceOf', {
      value: function instanceOfShim(type: new (...args: unknown[]) => unknown) {
        return this instanceof type;
      },
      writable: true,
      configurable: true
    });
  }
}
