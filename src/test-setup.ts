// Test environment setup.
//
// vitest 4 dropped the bundled jsdom/happy-dom `localStorage` shim under the
// 'node' environment, so we provide a minimal, spec-compliant in-memory
// localStorage here. This keeps unit tests independent of the DOM environment
// package version (jsdom vs happy-dom) and avoids flaky env-loading issues.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

// Only install when absent so a real DOM environment (if configured) wins.
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  })
}
