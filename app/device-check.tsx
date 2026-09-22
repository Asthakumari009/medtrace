import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { privateStorage } from "@/lib/privateStorage";
import { Button, Screen, Text } from "@/ui";

/** Available only in explicitly enabled internal builds; release checks reject
 * this flag for store builds. Exercises native crypto using temporary data. */
export default function DeviceCheck() {
  const enabled = process.env.EXPO_PUBLIC_ENABLE_DEVICE_CHECKS === "1";
  const router = useRouter();
  const [result, setResult] = useState("Running native storage checks…");
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const key = `vita.device-check.${Date.now()}`;
    const encryptedKey = `vita.encrypted.v1.${key}`;
    void (async () => {
      try {
        if (Platform.OS === "web")
          throw new Error("Run this check in the installed native app.");
        const text = "Synthetic storage test · नमस्ते · ఆరోగ్యం 🌿 ".repeat(
          150,
        );
        await AsyncStorage.setItem(key, text);
        if ((await privateStorage.getItem(key)) !== text)
          throw new Error("Migration did not preserve Unicode data.");
        if ((await AsyncStorage.getItem(key)) !== null)
          throw new Error("Plaintext remained after migration.");
        const encrypted = await AsyncStorage.getItem(encryptedKey);
        if (!encrypted || encrypted.includes("Synthetic"))
          throw new Error("Encrypted payload was unavailable.");
        await AsyncStorage.setItem(encryptedKey, `AAAA${encrypted.slice(4)}`);
        let rejected = false;
        try {
          await privateStorage.getItem(key);
        } catch {
          rejected = true;
        }
        if (!rejected) throw new Error("Tampered ciphertext was accepted.");
        await privateStorage.setItem(key, "Synthetic final value");
        if ((await privateStorage.getItem(key)) !== "Synthetic final value")
          throw new Error("Write/read failed.");
        await privateStorage.removeItem(key);
        if ((await privateStorage.getItem(key)) !== null)
          throw new Error("Temporary data was not removed.");
        if (active)
          setResult(
            "PASS · Native AES-GCM, Unicode round-trip, verified plaintext migration, tamper rejection, and cleanup.",
          );
      } catch (error) {
        if (active)
          setResult(
            `FAIL · ${error instanceof Error ? error.message.slice(0, 240) : "Native storage check failed"}`,
          );
      } finally {
        await privateStorage.removeItem(key).catch(() => {});
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled]);
  if (!enabled) return <Redirect href="/(auth)/welcome" />;
  return (
    <Screen scroll>
      <View style={{ gap: 22, paddingTop: 28 }}>
        <Text variant="heading">MedTrace internal device check</Text>
        <Text accessibilityLabel="Native storage result" selectable>
          {result}
        </Text>
        <Text variant="caption" tone="soft">
          Uses temporary synthetic text. No patient records or cloud data are
          changed.
        </Text>
        <Button
          title="Open sample-data preview"
          onPress={() => router.replace("/preview")}
        />
      </View>
    </Screen>
  );
}
