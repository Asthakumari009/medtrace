import "../global.css";

import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { CrashScreen } from "@/components/CrashScreen";
import { initI18n } from "@/i18n";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { ThemeProvider, useTheme } from "@/ui";

void SplashScreen.preventAutoHideAsync();

// Any uncaught render error below the root lands on the branded crash
// screen with a reload action instead of a frozen tree.
export { CrashScreen as ErrorBoundary };

function RootNavigator() {
  const { isLoading } = useAuth();
  const { colors } = useTheme();
  const [i18nReady, setI18nReady] = useState(false);

  // Three weights, one family. Every extra face is cold-start cost.
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });

  useEffect(() => {
    void initI18n().then(() => setI18nReady(true));
  }, []);

  const ready = (fontsLoaded || !!fontError) && !isLoading && i18nReady;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 180,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="report/[id]"
          options={{ animation: "slide_from_bottom", gestureEnabled: true }}
        />
      </Stack>
    </View>
  );
}

function ThemedShell() {
  const { colors, scheme } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <AuthProvider>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedShell />
    </ThemeProvider>
  );
}
