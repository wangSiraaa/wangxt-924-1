class LocalStorageMock {
  constructor() { this.store = {} }
  clear() { this.store = {} }
  getItem(key) { return this.store[key] !== undefined ? this.store[key] : null }
  setItem(key, value) { this.store[key] = String(value) }
  removeItem(key) { delete this.store[key] }
  key(i) { return Object.keys(this.store)[i] || null }
  get length() { return Object.keys(this.store).length }
}

if (typeof globalThis !== 'undefined' && !globalThis.localStorage) {
  globalThis.localStorage = new LocalStorageMock()
}

export { LocalStorageMock }
