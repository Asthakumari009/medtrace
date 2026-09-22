import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createEncryptedStorage,
  type StorageCipher,
} from "../src/lib/storageCore";

async function fixture() {
  const map = new Map<string, string>();
  const key = await webcrypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const cipher: StorageCipher = {
    seal: async (value, context) => {
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      const bytes = await webcrypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: new TextEncoder().encode(context),
        },
        key,
        new TextEncoder().encode(value),
      );
      return Buffer.concat([Buffer.from(iv), Buffer.from(bytes)]).toString(
        "base64",
      );
    },
    open: async (value, context) => {
      const bytes = Buffer.from(value, "base64");
      return new TextDecoder().decode(
        await webcrypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: bytes.subarray(0, 12),
            additionalData: new TextEncoder().encode(context),
          },
          key,
          bytes.subarray(12),
        ),
      );
    },
  };
  const backing = {
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: async (k: string) => {
      map.delete(k);
    },
  };
  return {
    map,
    backing,
    cipher,
    storage: createEncryptedStorage(backing, cipher),
  };
}
test("verified migration preserves Unicode and removes plaintext only after encrypted persistence", async () => {
  const { map, storage } = await fixture();
  const value = "Private note · नमस्ते · ఆరోగ్యం 🌿".repeat(100);
  map.set("journal", value);
  assert.equal(await storage.getItem("journal"), value);
  assert.equal(map.has("journal"), false);
  assert.equal(
    map.get("vita.encrypted.v1.journal")!.includes("Private"),
    false,
  );
  assert.equal(await storage.getItem("journal"), value);
});
test("failed migration preserves original data and can be retried", async () => {
  const { map, backing, cipher } = await fixture();
  map.set("journal", "Keep this note");
  const storage = createEncryptedStorage(
    {
      ...backing,
      setItem: async () => {
        throw new Error("disk full");
      },
    },
    cipher,
  );
  await assert.rejects(storage.getItem("journal"));
  assert.equal(map.get("journal"), "Keep this note");
  assert.equal(
    await createEncryptedStorage(backing, cipher).getItem("journal"),
    "Keep this note",
  );
});
test("tampering and swapped account records fail closed without plaintext fallback", async () => {
  const { map, storage } = await fixture();
  await storage.setItem("patient-a", "A note");
  map.set(
    "vita.encrypted.v1.patient-b",
    map.get("vita.encrypted.v1.patient-a")!,
  );
  map.set("patient-b", "Stale plaintext");
  await assert.rejects(storage.getItem("patient-b"));
  map.set("vita.encrypted.v1.patient-a", "damaged");
  await assert.rejects(storage.getItem("patient-a"));
});
test("concurrent operations preserve order and deletion removes both storage forms", async () => {
  const { map, storage } = await fixture();
  await Promise.all([
    storage.setItem("journal", "first"),
    storage.setItem("journal", "second"),
  ]);
  assert.equal(await storage.getItem("journal"), "second");
  await storage.removeItem("journal");
  assert.equal(await storage.getItem("journal"), null);
  assert.equal(map.size, 0);
});
