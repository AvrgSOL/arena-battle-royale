import { Buffer } from 'buffer';
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  if (!(window as any).process) (window as any).process = { env: {}, version: '', browser: true };
}
(globalThis as any).Buffer  = Buffer;
(globalThis as any).process ??= { env: {}, version: '', browser: true };
