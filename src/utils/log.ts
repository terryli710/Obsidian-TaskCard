// Plain console logger.
//
// This used to be winston, but winston is a Node library and was `require`d at
// module load time, which pulls Node built-ins into the bundle on every
// platform. Obsidian only exposes Node/Electron APIs on desktop, so a plugin
// that touches them must declare `isDesktopOnly: true`. TaskCard's cards and
// queries are meant to work on mobile, so the logger uses the console instead.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const LABEL = 'Obsidian Task Card';

// esbuild substitutes process.env.NODE_ENV at build time, so this is a constant
// in the bundle rather than a runtime lookup. Released builds stay quiet unless
// something actually went wrong.
const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function emit(level: LogLevel, message: unknown, ...meta: unknown[]): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const prefix = `${timestamp()} [${LABEL}] ${level}:`;
  const sink = level === 'debug' ? console.debug : console[level];
  sink(prefix, message, ...meta);
}

export const logger = {
  debug: (message: unknown, ...meta: unknown[]) =>
    emit('debug', message, ...meta),
  info: (message: unknown, ...meta: unknown[]) => emit('info', message, ...meta),
  warn: (message: unknown, ...meta: unknown[]) => emit('warn', message, ...meta),
  error: (message: unknown, ...meta: unknown[]) =>
    emit('error', message, ...meta)
};
