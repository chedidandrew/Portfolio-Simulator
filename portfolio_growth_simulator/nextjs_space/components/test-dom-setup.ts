import { JSDOM } from 'jsdom'

export const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000/' })
const boundingRect = {
  x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 320,
  width: 1000, height: 320, toJSON: () => ({}),
}

const browserGlobals = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  self: dom.window,
  localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
  HTMLSelectElement: dom.window.HTMLSelectElement,
  HTMLButtonElement: dom.window.HTMLButtonElement,
  SVGElement: dom.window.SVGElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  DocumentFragment: dom.window.DocumentFragment,
  MutationObserver: dom.window.MutationObserver,
  CustomEvent: dom.window.CustomEvent,
  Event: dom.window.Event,
  KeyboardEvent: dom.window.KeyboardEvent,
  MouseEvent: dom.window.MouseEvent,
  PointerEvent: dom.window.MouseEvent,
  DOMException: dom.window.DOMException,
  NodeFilter: dom.window.NodeFilter,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    const timer = setTimeout(() => callback(performance.now()), 0)
    timer.unref()
    return Number(timer)
  },
  cancelAnimationFrame: (id: number) => clearTimeout(id),
  IS_REACT_ACT_ENVIRONMENT: true,
}

for (const [name, value] of Object.entries(browserGlobals)) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  })
}

Object.defineProperty(dom.window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})
Object.defineProperty(dom.window, 'scrollTo', { value: () => undefined })
Object.defineProperty(dom.window.HTMLElement.prototype, 'getBoundingClientRect', { value: () => boundingRect })
Object.defineProperty(dom.window.SVGElement.prototype, 'getBoundingClientRect', { value: () => boundingRect })
Object.defineProperty(dom.window.HTMLElement.prototype, 'clientWidth', { get: () => 1000 })
Object.defineProperty(dom.window.HTMLElement.prototype, 'clientHeight', { get: () => 320 })
Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', { get: () => 1000 })
Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetHeight', { get: () => 320 })
Object.defineProperty(dom.window.HTMLElement.prototype, 'attachEvent', { value: () => undefined })
Object.defineProperty(dom.window.HTMLElement.prototype, 'detachEvent', { value: () => undefined })
Object.defineProperty(dom.window.HTMLElement.prototype, 'hasPointerCapture', { value: () => false })
Object.defineProperty(dom.window.HTMLElement.prototype, 'setPointerCapture', { value: () => undefined })
Object.defineProperty(dom.window.HTMLElement.prototype, 'releasePointerCapture', { value: () => undefined })
Object.defineProperty(dom.window.HTMLElement.prototype, 'scrollIntoView', { value: () => undefined })

class ResizeObserverMock {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback([{ target, contentRect: boundingRect } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock {
  readonly root = null
  readonly rootMargin = '0px'
  readonly thresholds = [0]
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}

Object.assign(globalThis, {
  ResizeObserver: ResizeObserverMock,
  IntersectionObserver: IntersectionObserverMock,
})
Object.assign(dom.window, { IntersectionObserver: IntersectionObserverMock })
