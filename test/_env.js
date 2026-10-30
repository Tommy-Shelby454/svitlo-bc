// Запускає app.js у «вигаданому» браузері (vm + макет DOM), щоб перевіряти логіку без браузера.
import vm from 'node:vm';
import fs from 'node:fs';

class El {
  constructor(tag) { this.nodeType = 1; this.tag = tag; this.children = []; this.attrs = {}; this.style = { setProperty() {} }; this.dataset = {}; this.listeners = {}; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, f) { (this.listeners[k] ||= []).push(f); }
  click() { (this.listeners.click || []).forEach((f) => f({ target: this })); }
  append(...k) { this.children.push(...k); }
  replaceChildren(...k) { this.children = []; this.append(...k); }
  remove() {}
  get text() { return this.children.map((c) => (c.nodeType === 3 ? c.text : c.text)).join(' '); }
}

export function makeEnv({ store = {}, fetchImpl, native = null } = {}) {
  const ls = new Map(Object.entries(store));
  const reg = Object.fromEntries(['app', 'hdr', 'ttl', 'sub', 'act', 'tabs'].map((id) => [id, new El(id)]));
  const body = new El('body');
  const doc = {
    getElementById: (id) => reg[id] ?? null,
    createElement: (t) => new El(t),
    createElementNS: (_, t) => new El(t),
    createTextNode: (t) => ({ nodeType: 3, text: String(t) }),
    body, documentElement: new El('html'),
    addEventListener() {}, visibilityState: 'visible',
  };
  const timers = [];
  const win = { scrollY: 0, addEventListener() {}, scrollTo() {}, Capacitor: native ? { isNativePlatform: () => true, Plugins: { LocalNotifications: native } } : undefined };
  const ctx = vm.createContext({
    document: doc, window: win, history: { pushState() {}, back() {} },
    localStorage: { getItem: (k) => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, v) },
    navigator: {}, fetch: fetchImpl || (() => Promise.reject(new Error('offline'))),
    requestAnimationFrame: (f) => f(), setInterval: (f) => timers.push(f) && 0, setTimeout: (f) => 0, clearTimeout() {}, console,
  });
  vm.runInContext(fs.readFileSync(new URL('../app/www/app.js', import.meta.url), 'utf8'), ctx);
  const run = (code) => vm.runInContext(code, ctx);
  return { ctx, run, reg, doc, ls, El };
}
export const flat = (n) => (n.nodeType === 3 ? n.text : `${n.children.map(flat).join(' ')}`);
