// Short-lived cache for library reads, so going Back re-renders instantly instead of
// re-fetching (pages are re-created on navigation). Any write to the same server clears it,
// so progress and watched state never look stale after playing something.

const TTL = 3 * 60_000;

export class ReadCache {
  #entries = new Map<string, { at: number; value: Promise<unknown> }>();

  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.#entries.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.value as Promise<T>;
    const value = load();
    this.#entries.set(key, { at: Date.now(), value });
    value.catch(() => this.#entries.delete(key));
    return value;
  }

  clear() {
    this.#entries.clear();
  }
}
