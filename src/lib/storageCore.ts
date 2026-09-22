export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export interface StorageCipher {
  seal(value: string, context: string): Promise<string>;
  open(value: string, context: string): Promise<string>;
}

/** Serialize each record; migrate only after a verified encrypted write.
 * A damaged ciphertext never falls back to a stale plaintext copy. */
export function createEncryptedStorage(
  backing: KeyValueStorage,
  cipher: StorageCipher,
): KeyValueStorage {
  const queues = new Map<string, Promise<unknown>>();
  const recordKey = (key: string) => `vita.encrypted.v1.${key}`;
  function serial<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const next = (queues.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(operation);
    queues.set(key, next);
    void next
      .finally(() => {
        if (queues.get(key) === next) queues.delete(key);
      })
      .catch(() => {});
    return next;
  }
  return {
    getItem: (key) =>
      serial(key, async () => {
        const stored = await backing.getItem(recordKey(key));
        if (stored !== null) {
          const value = await cipher.open(stored, key);
          await backing.removeItem(key);
          return value;
        }
        const legacy = await backing.getItem(key);
        if (legacy === null) return null;
        const sealed = await cipher.seal(legacy, key);
        await backing.setItem(recordKey(key), sealed);
        const persisted = await backing.getItem(recordKey(key));
        if (
          persisted === null ||
          (await cipher.open(persisted, key)) !== legacy
        )
          throw new Error("Could not verify the encrypted storage migration.");
        await backing.removeItem(key);
        return legacy;
      }),
    setItem: (key, value) =>
      serial(key, async () => {
        await backing.setItem(recordKey(key), await cipher.seal(value, key));
        await backing.removeItem(key);
      }),
    removeItem: (key) =>
      serial(key, async () => {
        await Promise.all([
          backing.removeItem(key),
          backing.removeItem(recordKey(key)),
        ]);
      }),
  };
}
