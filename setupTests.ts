import '@testing-library/jest-dom';

/**
 * Web Storage polyfill for the test environment.
 *
 * Node 26 ships an experimental native Web Storage API whose `localStorage` /
 * `sessionStorage` globals are inert unless `--localstorage-file` is provided.
 * That native global shadows jsdom's implementation, leaving `localStorage`
 * (and `window.localStorage`) `undefined` under Vitest. This breaks any test
 * that reads/writes storage or spies on `Storage.prototype`.
 *
 * We install a standards-compliant in-memory `Storage` only when the
 * environment's storage is actually broken, so this is a no-op on Node/jsdom
 * combinations where storage already works.
 */
class MemoryStorage {
    private readonly store = new Map<string, string>();

    get length(): number {
        return this.store.size;
    }

    clear(): void {
        this.store.clear();
    }

    getItem(key: string): string | null {
        return this.store.has(key) ? this.store.get(key)! : null;
    }

    setItem(key: string, value: string): void {
        this.store.set(String(key), String(value));
    }

    removeItem(key: string): void {
        this.store.delete(String(key));
    }

    key(index: number): string | null {
        return Array.from(this.store.keys())[index] ?? null;
    }
}

const isStorageBroken = (): boolean => {
    try {
        const ls = (globalThis as { localStorage?: Storage }).localStorage;
        if (!ls) return true;
        const probe = '__storage_probe__';
        ls.setItem(probe, '1');
        const ok = ls.getItem(probe) === '1';
        ls.removeItem(probe);
        return !ok;
    } catch {
        return true;
    }
};

if (isStorageBroken()) {
    // Replace the global Storage constructor so `Storage.prototype` spies resolve
    // to the same prototype the instances inherit from.
    (globalThis as { Storage: typeof Storage }).Storage = MemoryStorage as unknown as typeof Storage;

    const define = (target: object, instance: MemoryStorage) => {
        Object.defineProperty(target, 'localStorage', { value: instance, configurable: true, writable: false });
    };
    const defineSession = (target: object, instance: MemoryStorage) => {
        Object.defineProperty(target, 'sessionStorage', { value: instance, configurable: true, writable: false });
    };

    const localStorageInstance = new MemoryStorage();
    const sessionStorageInstance = new MemoryStorage();

    define(globalThis, localStorageInstance);
    defineSession(globalThis, sessionStorageInstance);

    if (typeof window !== 'undefined') {
        define(window, localStorageInstance);
        defineSession(window, sessionStorageInstance);
        (window as unknown as { Storage: typeof Storage }).Storage = MemoryStorage as unknown as typeof Storage;
    }
}
