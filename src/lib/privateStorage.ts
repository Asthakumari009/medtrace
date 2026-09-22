import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createEncryptedStorage, type KeyValueStorage } from "./storageCore";

const KEY_NAME = "vita.local-encryption-key.v1";
const OPTIONS: SecureStore.SecureStoreOptions = {
  // Background health sync can read credentials after the first device unlock.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
let keyFlight: Promise<AESEncryptionKey> | null = null;
async function encryptionKey(create: boolean): Promise<AESEncryptionKey> {
  if (!keyFlight) {
    keyFlight = (async () => {
      const raw = await SecureStore.getItemAsync(KEY_NAME, OPTIONS);
      if (raw) return AESEncryptionKey.import(raw, "base64");
      if (!create)
        throw new Error(
          "The device encryption key is unavailable. Saved local data cannot be opened.",
        );
      const key = await AESEncryptionKey.generate();
      await SecureStore.setItemAsync(
        KEY_NAME,
        await key.encoded("base64"),
        OPTIONS,
      );
      return key;
    })().catch((error) => {
      keyFlight = null;
      throw error;
    });
  }
  return keyFlight;
}
const nativeStorage = createEncryptedStorage(AsyncStorage, {
  seal: async (value, context) => {
    try {
      const key = await encryptionKey(true);
      const sealed = await aesEncryptAsync(new TextEncoder().encode(value), key, {
        additionalData: new TextEncoder().encode(context),
      });
      return await sealed.combined("base64");
    } catch {
      // Native bridge errors can echo their arguments. Never expose record data.
      throw new Error("Saved data could not be encrypted on this device.");
    }
  },
  open: async (value, context) => {
    try {
      const key = await encryptionKey(false);
      // SDK 57's Android bridge requires bytes here despite the public string
      // overload. Decode stored base64 before crossing that native boundary.
      const binary = atob(value);
      const combined = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++)
        combined[index] = binary.charCodeAt(index);
      const bytes = await aesDecryptAsync(
        AESSealedData.fromCombined(combined),
        key,
        { additionalData: new TextEncoder().encode(context) },
      );
      return new TextDecoder().decode(bytes);
    } catch {
      throw new Error("Saved data could not be decrypted on this device.");
    }
  },
});

/** Native AES-GCM ciphertext with a device-held key. Web storage has the
 * browser's origin protections, not a native Keychain security boundary. */
export const privateStorage: KeyValueStorage =
  Platform.OS === "web" ? AsyncStorage : nativeStorage;
