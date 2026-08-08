// A very small DOM stand-in, so the render path can be smoke-tested in Node.
//
// This exists because the alternative is shipping the front end completely unexercised until it
// reaches a browser. It implements only what js/ui.js and the page controllers actually touch -
// it is not a browser, and it makes no attempt to be. Anything visual still has to be checked by
// eye; what this catches is the render throwing, or a tile coming out empty.

class FakeClassList {
  constructor(node) {
    this.node = node;
  }

  add(...names) {
    const set = new Set(this.node.className.split(' ').filter(Boolean));
    names.forEach((name) => set.add(name));
    this.node.className = [...set].join(' ');
  }

  remove(...names) {
    const set = new Set(this.node.className.split(' ').filter(Boolean));
    names.forEach((name) => set.delete(name));
    this.node.className = [...set].join(' ');
  }

  contains(name) {
    return this.node.className.split(' ').includes(name);
  }
}

class FakeNode {
  constructor(tagName, document) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.className = '';
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.dataset = {};
    this.classList = new FakeClassList(this);
    this.value = '';
    this.disabled = false;
    this._text = '';
    this._html = '';
  }

  // Text is the concatenation of this node's own text and its children's, which is what makes
  // assertions like "this tile says FULL" possible.
  get textContent() {
    return this._text + this.children.map((child) => child.textContent ?? '').join('');
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  get innerHTML() {
    return this._html;
  }

  set innerHTML(value) {
    this._html = String(value);
  }

  append(...nodes) {
    for (const node of nodes) {
      this.children.push(node);
      if (node instanceof FakeNode) node.parentNode = this;
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.ownerDocument.register(String(value), this);
    if (name === 'class') this.className = String(value);
    if (name === 'value') this.value = String(value);
    if (name === 'disabled') this.disabled = true;
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  addEventListener(type, handler) {
    (this.listeners[type] ??= []).push(handler);
  }

  /** Fire a listener, the way a tap would. */
  dispatch(type) {
    for (const handler of this.listeners[type] ?? []) handler({ type, target: this });
  }

  scrollIntoView() {}

  /** Supports only the flat, comma-separated class selectors the app actually uses. */
  querySelectorAll(selector) {
    const wanted = selector.split(',').map((part) => part.trim());
    const found = [];

    const walk = (node) => {
      for (const child of node.children) {
        if (!(child instanceof FakeNode)) continue;
        if (wanted.some((sel) => matches(child, sel))) found.push(child);
        walk(child);
      }
    };

    walk(this);
    return found;
  }

  /** Every descendant whose class list includes a name. */
  findAll(className) {
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (!(child instanceof FakeNode)) continue;
        if (child.classList.contains(className)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

function matches(node, selector) {
  // Handles ".a .b" and ".a" and "#id .b" loosely: the last class in the selector must match.
  const last = selector.trim().split(/\s+/).pop();
  if (last.startsWith('.')) return node.classList.contains(last.slice(1));
  if (last.startsWith('#')) return node.getAttribute('id') === last.slice(1);
  return node.tagName === last.toUpperCase();
}

class FakeDocument {
  constructor() {
    this.byId = new Map();
    this.documentElement = new FakeNode('html', this);
    this.body = new FakeNode('body', this);
  }

  createElement(tag) {
    return new FakeNode(tag, this);
  }

  createTextNode(text) {
    const node = new FakeNode('#text', this);
    node._text = String(text);
    return node;
  }

  register(id, node) {
    this.byId.set(id, node);
  }

  getElementById(id) {
    return this.byId.get(id) ?? null;
  }

  /** Pre-create a container the HTML would have declared. */
  container(id) {
    const node = new FakeNode('div', this);
    node.setAttribute('id', id);
    this.body.append(node);
    return node;
  }
}

/**
 * Install the globals a page controller expects, and return the fake document.
 *
 * @param {object} options
 * @param {string[]} options.containers ids the page's HTML declares
 * @param {Array}  [options.bookings]   what fetch should return for data/bookings.json
 */
export function installFakeDom({ containers = [], bookings = [] } = {}) {
  const document = new FakeDocument();
  containers.forEach((id) => document.container(id));

  const store = new Map();

  globalThis.document = document;
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
    confirm: () => true,
    // No AudioContext: sound.js is expected to shrug and stay silent.
  };
  globalThis.performance = globalThis.performance ?? { now: () => 0 };
  globalThis.requestAnimationFrame = (callback) => callback(0);

  globalThis.fetch = async (url) => {
    if (String(url).startsWith('data/bookings.json')) {
      return { ok: true, status: 200, json: async () => ({ version: 1, bookings }) };
    }
    throw new Error(`Unexpected fetch in the smoke test: ${url}`);
  };

  return document;
}
