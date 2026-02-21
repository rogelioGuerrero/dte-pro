/**
 * Shim for Node.js AsyncLocalStorage to allow LangGraph to build in the browser.
 * This provides a minimal implementation that basically does nothing or stores state globally/locally without async context propagation guarantees (which are impossible in pure browser JS without Zone.js).
 */
export class AsyncLocalStorage<T = any> {
  private store: T | undefined;

  constructor() {
    this.store = undefined;
  }

  disable(): void {
    this.store = undefined;
  }

  getStore(): T | undefined {
    return this.store;
  }

  run<R>(store: T, callback: (...args: any[]) => R, ...args: any[]): R {
    const oldStore = this.store;
    this.store = store;
    try {
      return callback(...args);
    } finally {
      this.store = oldStore;
    }
  }

  exit<R>(callback: (...args: any[]) => R, ...args: any[]): R {
    const oldStore = this.store;
    this.store = undefined;
    try {
      return callback(...args);
    } finally {
      this.store = oldStore;
    }
  }

  enterWith(store: T): void {
    this.store = store;
  }
}
