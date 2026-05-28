// Minimal Cache API polyfill for the "worker" vitest project, so handlers that
// use `caches.default` (via withCache) can run in the node environment without
// spinning up the full workerd pool. Keyed by request URL; clones on store/read
// to mirror the real Cache contract closely enough for our read-through logic.
class MemoryCache {
  private store = new Map<string, Response>();

  async match(request: Request | string): Promise<Response | undefined> {
    const key = typeof request === "string" ? request : request.url;
    const hit = this.store.get(key);
    return hit ? hit.clone() : undefined;
  }

  async put(request: Request | string, response: Response): Promise<void> {
    const key = typeof request === "string" ? request : request.url;
    this.store.set(key, response.clone());
  }

  async delete(request: Request | string): Promise<boolean> {
    const key = typeof request === "string" ? request : request.url;
    return this.store.delete(key);
  }
}

const caches = {
  default: new MemoryCache(),
  async open(): Promise<MemoryCache> {
    return new MemoryCache();
  },
};

(globalThis as unknown as { caches: unknown }).caches = caches;
